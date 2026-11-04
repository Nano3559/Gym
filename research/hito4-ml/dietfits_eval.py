"""Offline research only. No Supabase access, application inference or automatic deployment."""
from __future__ import annotations

import argparse
import csv
import hashlib
import importlib.metadata
import json
import math
import platform
import shutil
import subprocess
import tempfile
from pathlib import Path

import numpy as np
import pandas as pd

VERSION = "dietfits-three-months-research-v1"
TIME_MAP = {"a.BL": 0, "b.3": 3, "c.6": 6, "d.12": 12}
FEATURES = ["weight_start_kg", "intake_start_kcal_day", "expenditure_start_kcal_day"]
REQUIRED = ["study_id", "time", "weight_gcrc", "cal", "par_kcal_kg_day"]
RANGES = {"weight_gcrc": (20, 500), "cal": (0, 15000), "par_kcal_kg_day": (10, 100)}
MISSING = {"", "NA", "N/A", "NaN", "nan", "null", "."}
SEED = 407
MIN_COUNTS = {"train": 80, "validation": 20, "calibration": 20, "test": 40}


def write_json(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False), encoding="utf-8")


def file_hash(path: Path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_csv(path: Path):
    if path.stat().st_size > 50_000_000:
        raise ValueError("El archivo supera el límite de auditoría de 50 MB.")
    with path.open(encoding="utf-8-sig", newline="") as stream:
        headers = next(csv.reader(stream), [])
    if len(headers) != len(set(headers)):
        raise ValueError("Hay nombres de columnas duplicados.")
    return pd.read_csv(path, dtype=str, keep_default_na=False, encoding="utf-8-sig")


def audit_frame(raw: pd.DataFrame):
    missing_columns = sorted(set(REQUIRED) - set(raw.columns))
    if missing_columns:
        raise ValueError(f"Faltan columnas: {', '.join(missing_columns)}")
    frame = raw[REQUIRED].copy().map(lambda x: str(x).strip() if pd.notna(x) else "")
    frame["month"] = frame["time"].map(TIME_MAP)
    unknown_times = sorted(set(frame.loc[frame["month"].isna(), "time"]))
    missing_ids = int(frame["study_id"].isin(MISSING).sum())
    duplicate_keys = int(frame.duplicated(["study_id", "time"], keep=False).sum())
    report = {"rows": len(frame), "participants": int(frame.loc[~frame.study_id.isin(MISSING), "study_id"].nunique()),
              "duplicate_key_rows": duplicate_keys, "exact_duplicate_rows": int(raw.duplicated().sum()),
              "missing_ids": missing_ids, "unknown_time_values": unknown_times, "columns": {}, "visits": {}}
    for name, (lower, upper) in RANGES.items():
        absent = frame[name].isin(MISSING)
        numeric = pd.to_numeric(frame[name].mask(absent), errors="coerce")
        invalid = (~absent & numeric.isna()) | (~numeric.isna() & ~np.isfinite(numeric))
        outside = numeric.notna() & ((numeric < lower) | (numeric > upper))
        finite = numeric[np.isfinite(numeric)]
        report["columns"][name] = {"missing": int(absent.sum()), "invalid_numeric": int(invalid.sum()),
                                    "outside_review_range": int(outside.sum()), "review_range": [lower, upper],
                                    "min": float(finite.min()) if len(finite) else None,
                                    "max": float(finite.max()) if len(finite) else None}
        frame[name] = numeric.astype(float)
    for month in (0, 3, 6, 12):
        visit = frame[frame.month == month]
        complete = visit[["weight_gcrc", "cal", "par_kcal_kg_day"]].notna().all(axis=1)
        report["visits"][str(month)] = {"rows": len(visit), "complete_three_fields": int(complete.sum())}
    report["usable_structure"] = not (unknown_times or missing_ids or duplicate_keys or any(
        c["invalid_numeric"] or c["outside_review_range"] for c in report["columns"].values()))
    return frame, report


def build_pairs(frame: pd.DataFrame, origin: int):
    if origin not in (0, 3):
        raise ValueError("Solo se predefinieron intervalos 0→3 y 3→6 meses; no se interpolan visitas.")
    if frame.duplicated(["study_id", "month"]).any():
        raise ValueError("Hay visitas duplicadas; no se elige una silenciosamente.")
    start = frame[frame.month == origin].set_index("study_id")
    end = frame[frame.month == origin + 3].set_index("study_id")
    both = start.join(end[["weight_gcrc"]], how="inner", rsuffix="_end")
    both = both[both.weight_gcrc.notna() & both.weight_gcrc_end.notna()]
    pairs = pd.DataFrame({"study_id": both.index, "origin_month": origin,
                          "weight_start_kg": both.weight_gcrc.to_numpy(),
                          "intake_start_kcal_day": both.cal.to_numpy(),
                          "expenditure_start_kcal_day": (both.par_kcal_kg_day * both.weight_gcrc).to_numpy(),
                          "weight_end_kg": both.weight_gcrc_end.to_numpy()})
    pairs["delta_kg"] = pairs.weight_end_kg - pairs.weight_start_kg
    return pairs.reset_index(drop=True)


def participant_partitions(baseline_ids):
    ids = sorted(set(str(x) for x in baseline_ids), key=lambda x: hashlib.sha256(f"{SEED}:{x}".encode()).hexdigest())
    n = len(ids)
    cuts = (int(n * .60), int(n * .75), int(n * .85))
    return {name: set(values) for name, values in zip(MIN_COUNTS, (ids[:cuts[0]], ids[cuts[0]:cuts[1]], ids[cuts[1]:cuts[2]], ids[cuts[2]:]))}


def split_pairs(pairs, partitions):
    all_ids = [participant for values in partitions.values() for participant in values]
    if len(all_ids) != len(set(all_ids)):
        raise ValueError("Un participante aparece en más de una partición.")
    if not set(pairs.study_id).issubset(set(all_ids)):
        raise ValueError("Hay pares sin una asignación de participante.")
    return {name: pairs[pairs.study_id.isin(ids)].reset_index(drop=True) for name, ids in partitions.items()}


def metrics(actual, prediction, radius=None):
    actual, prediction = np.asarray(actual, dtype=float), np.asarray(prediction, dtype=float)
    if actual.ndim != 1 or actual.shape != prediction.shape or not np.isfinite(actual).all() or not np.isfinite(prediction).all():
        raise ValueError("Resultados o predicciones no finitos o de distinta longitud.")
    if radius is not None and (not np.isfinite(radius) or radius < 0):
        raise ValueError("Radio de intervalo no válido.")
    if not len(actual):
        return {"count": 0, "mae_kg": None, "bias_kg": None, "rmse_kg": None, "coverage": None, "mean_width_kg": None}
    error = prediction - actual
    return {"count": len(actual), "mae_kg": float(np.abs(error).mean()), "bias_kg": float(error.mean()),
            "rmse_kg": float(np.sqrt((error ** 2).mean())),
            "coverage": float((np.abs(error) <= radius).mean()) if radius is not None else None,
            "mean_width_kg": float(2 * radius) if radius is not None else None}


def conformal_radius(actual, prediction, alpha=.10):
    metrics(actual, prediction)
    if not 0 < alpha < 1:
        raise ValueError("El nivel de error debe estar entre cero y uno.")
    scores = np.abs(np.asarray(actual, dtype=float) - np.asarray(prediction, dtype=float))
    k = math.ceil((len(scores) + 1) * (1 - alpha))
    if not len(scores) or k > len(scores) or not np.isfinite(scores).all():
        raise ValueError("Calibración insuficiente para el nivel nominal solicitado.")
    return float(np.sort(scores)[k - 1])


def paired_improvement(actual, prediction, baseline, repetitions=2000):
    # Primary test has exactly one pair per person: bootstrap units are participants.
    errors = np.abs(np.asarray(actual) - np.asarray(baseline)) - np.abs(np.asarray(actual) - np.asarray(prediction))
    if not len(errors) or not np.isfinite(errors).all():
        raise ValueError("No hay errores válidos para comparar.")
    rng = np.random.default_rng(SEED)
    boot = [float(rng.choice(errors, len(errors), replace=True).mean()) for _ in range(repetitions)]
    return {"mean_mae_improvement_kg": float(errors.mean()), "bootstrap_95_percentile_kg": np.quantile(boot, [.025, .975]).tolist(), "participants": len(errors)}


def passes_improvement(model_mae, baseline_mae):
    return baseline_mae > 0 and baseline_mae - model_mae >= .2 and (baseline_mae - model_mae) / baseline_mae >= .05


def verify_review(review, source_hash):
    if review.get("source_sha256") != source_hash:
        raise ValueError("La revisión debe corresponder al SHA-256 exacto del archivo original.")
    checks = ["research_use_documented", "dictionary_and_units_verified", "scheduled_visits_verified"]
    if any(review.get(key) is not True for key in checks):
        raise ValueError("Falta documentar uso autorizado, diccionario/unidades o visitas; no se entrena.")
    if not isinstance(review.get("permission_evidence"), str) or not review["permission_evidence"].strip():
        raise ValueError("Falta la evidencia concreta del alcance de uso.")


def fit_candidates(train, validation):
    # Imported only here: auditing and the core tests need no scikit-learn installation.
    from sklearn.pipeline import Pipeline
    from sklearn.impute import SimpleImputer
    from sklearn.preprocessing import StandardScaler
    from sklearn.linear_model import Ridge
    from sklearn.ensemble import HistGradientBoostingRegressor
    if train[FEATURES].isna().all().any():
        raise ValueError("Una entrada está completamente ausente en entrenamiento.")
    def pipeline(estimator):
        return Pipeline([("impute", SimpleImputer(strategy="median")), ("scale", StandardScaler()), ("model", estimator)])
    candidates = []
    for alpha in (.1, 1., 10., 100., 1000.):
        fitted = pipeline(Ridge(alpha=alpha)).fit(train[FEATURES], train.delta_kg)
        error = metrics(validation.delta_kg, fitted.predict(validation[FEATURES]))["mae_kg"]
        candidates.append((error, f"ridge-alpha-{alpha}", fitted))
    ridge = min(candidates, key=lambda item: (item[0], item[1]))
    constant_mae = metrics(validation.delta_kg, np.zeros(len(validation)))["mae_kg"]
    mean_mae = metrics(validation.delta_kg, np.full(len(validation), train.delta_kg.mean()))["mae_kg"]
    boost_gate = passes_improvement(ridge[0], constant_mae) and passes_improvement(ridge[0], mean_mae)
    if boost_gate:
        for leaves in (3, 7):
            fitted = pipeline(HistGradientBoostingRegressor(max_leaf_nodes=leaves, max_iter=100, learning_rate=.05, min_samples_leaf=20, early_stopping=False, random_state=SEED)).fit(train[FEATURES], train.delta_kg)
            error = metrics(validation.delta_kg, fitted.predict(validation[FEATURES]))["mae_kg"]
            candidates.append((error, f"boost-leaves-{leaves}", fitted))
    # Selection is frozen before any calibration or test labels are inspected.
    selected = min(candidates, key=lambda item: (item[0], item[1]))
    return selected, {"ridge_validation_mae_kg": ridge[0], "boosting_tested": boost_gate,
                      "selection": "validation_only", "candidates": [{"name": name, "validation_mae_kg": error} for error, name, _ in candidates]}


def export_ridge(pipeline):
    from sklearn.linear_model import Ridge
    if not isinstance(pipeline.named_steps["model"], Ridge):
        return None
    scaler, imputer, ridge = (pipeline.named_steps[k] for k in ("scale", "impute", "model"))
    return {"version": VERSION, "deployable": False, "horizon_months": 3, "features": FEATURES,
            "imputation": imputer.statistics_.tolist(), "mean": scaler.mean_.tolist(), "scale": scaler.scale_.tolist(),
            "coefficients": ridge.coef_.tolist(), "intercept": float(ridge.intercept_)}


def predict_export(export, values):
    array = np.asarray(values, dtype=float)
    array = np.where(np.isnan(array), np.asarray(export["imputation"]), array)
    return ((array - np.asarray(export["mean"])) / np.asarray(export["scale"])) @ np.asarray(export["coefficients"]) + export["intercept"]


def check_javascript_export(export, values, expected):
    node=shutil.which('node')
    if node is None:
        return {'status':'not_executed_node_unavailable'}
    root=Path(__file__).resolve().parent/'.test-work'
    root.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(dir=root) as folder:
        folder=Path(folder).resolve()
        if folder.parent!=root:
            raise ValueError('La verificación quedó fuera de su carpeta de trabajo.')
        modelpath,rows_path=folder/'model.json',folder/'rows.json'
        rows=[[None if pd.isna(value) else float(value) for value in row] for row in np.asarray(values)]
        write_json(modelpath,export);write_json(rows_path,rows)
        output=subprocess.check_output([node,str(Path(__file__).with_name('predict-research.mjs')),str(modelpath),str(rows_path)],text=True)
        actual=np.asarray(json.loads(output),dtype=float)
        if not np.allclose(actual,expected,rtol=1e-10,atol=1e-10):
            raise ValueError('La exportación JavaScript no reproduce las predicciones de scikit-learn.')
        return {'status':'passed','max_absolute_error':float(np.max(np.abs(actual-expected)))}


def benchmark(frame, review, source_hash):
    verify_review(review, source_hash)
    primary, temporal = build_pairs(frame, 0), build_pairs(frame, 3)
    partitions = participant_partitions(frame.loc[frame.month == 0, "study_id"])
    splits = split_pairs(primary, partitions)
    counts = {name: {"pairs": len(part), "participants": int(part.study_id.nunique())} for name, part in splits.items()}
    if any(counts[name]["participants"] < minimum for name, minimum in MIN_COUNTS.items()):
        raise ValueError(f"Participantes insuficientes por partición: {counts}")
    if primary.study_id.duplicated().any():
        raise ValueError("El análisis principal debe tener un solo par por participante.")
    selected, selection = fit_candidates(splits["train"], splits["validation"])
    _, name, model = selected
    calibration, test = splits["calibration"], splits["test"]
    radius = conformal_radius(calibration.delta_kg, model.predict(calibration[FEATURES]))
    delta = model.predict(test[FEATURES])
    current, actual = test.weight_start_kg.to_numpy(), test.weight_end_kg.to_numpy()
    predictions = current + delta
    mean_delta = float(splits["train"].delta_kg.mean())
    constant, cohort_mean = current, current + mean_delta
    comparison = {"constant_weight": metrics(actual, constant), "train_mean_change": metrics(actual, cohort_mean),
                  "candidate": metrics(actual, predictions, radius)}
    improvements = {"constant_weight": paired_improvement(actual, predictions, constant), "train_mean_change": paired_improvement(actual, predictions, cohort_mean)}
    qualifies = all(passes_improvement(comparison["candidate"]["mae_kg"], comparison[key]["mae_kg"]) and improvements[key]["bootstrap_95_percentile_kg"][0] > 0 for key in improvements)
    temporal_test = temporal[temporal.study_id.isin(partitions["test"])].copy()
    temporal_result = {"participants": int(temporal_test.study_id.nunique()), "pairs": len(temporal_test), "horizon_months": 3, "origin_month": 3}
    if len(temporal_test):
        predicted = temporal_test.weight_start_kg.to_numpy() + model.predict(temporal_test[FEATURES])
        temporal_result.update(candidate=metrics(temporal_test.weight_end_kg, predicted, radius), constant_weight=metrics(temporal_test.weight_end_kg, temporal_test.weight_start_kg))
        old = frame[frame.month == 0].set_index("study_id").weight_gcrc
        available = temporal_test.study_id.map(old).notna()
        subset = temporal_test[available]
        extrapolated = subset.weight_start_kg + (subset.weight_start_kg - subset.study_id.map(old))
        temporal_result["sparse_visit_trend_exploratory"] = metrics(subset.weight_end_kg, extrapolated)
    export = export_ridge(model)
    if export is not None and not np.allclose(predict_export(export, test[FEATURES]), delta, rtol=1e-10, atol=1e-10):
        raise ValueError("La exportación no reproduce la transformación y regresión.")
    javascript_parity=check_javascript_export(export,test[FEATURES],delta) if export is not None else {'status':'not_applicable_boost_selected'}
    split_hashes = {name: hashlib.sha256("\n".join(sorted(ids)).encode()).hexdigest() for name, ids in partitions.items()}
    report = {"version": VERSION, "source_sha256": source_hash, "horizon_months": 3, "origin_month": 0,
              "split_counts": counts, "split_hashes": split_hashes, "selection": selection, "selected_model": name,
              "calibration": {"participants": len(calibration), "nominal_coverage": .9, "radius_kg": radius},
              "test": comparison, "paired_improvements": improvements, "temporal_diagnostic": temporal_result,
              "research_candidate_qualifies": qualifies, "integrate_in_app": False,
              "research_export_javascript_parity":javascript_parity,
              "decision": "research_3_month_candidate_requires_external_validation" if qualifies else "retain_existing_method",
              "sprint6_comparison": "not_comparable_no_daily_weights_and_different_horizon",
              "six_month_model": "not_evaluated_requires_separate_prespecified_protocol",
              "versions": {"python": platform.python_version(), **{p: importlib.metadata.version(p) for p in ("numpy", "pandas", "scikit-learn")}}}
    return report, export


def readiness(csv_path=None):
    import importlib.util
    available = csv_path is not None and csv_path.is_file()
    return {"version": VERSION, "status": "not_evaluated", "source_file_available_unverified": available, "training_executed": False,
            "integrate_in_app": False, "blocking_conditions": ["Original DIETFITS no disponible; descarga bloqueada por DNS.",
            "Alcance de autorización del archivo y diccionario pendientes de verificar.", "Aceptación real de sprints 1–6 pendiente.",
            "No hay evidencia de mejora ni validación del horizonte de siete días."],
            "dependencies_available": {name: importlib.util.find_spec(name) is not None for name in ("numpy", "pandas", "sklearn")}}


def main():
    parser = argparse.ArgumentParser(description="Auditoría y evaluación offline de DIETFITS a tres meses; nunca despliega.")
    parser.add_argument("command", choices=["status", "audit", "evaluate"])
    parser.add_argument("--csv", type=Path)
    parser.add_argument("--review", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    if args.command == "status":
        status=readiness(args.csv)
        if status['source_file_available_unverified']:
            status['blocking_conditions'][0]='Archivo local presente, pendiente de auditar y verificar procedencia.'
        write_json(args.out / "readiness.json", status)
        return 0
    if args.csv is None:
        parser.error("Se requiere --csv con el archivo original.")
    source_hash = file_hash(args.csv)
    if args.command == 'evaluate' and (args.out / 'benchmark.json').exists():
        raise ValueError('Este directorio ya contiene un benchmark: no se sobrescribe ni reutiliza el test para ajustar modelos.')
    if (args.out / 'audit.json').exists() and json.loads((args.out / 'audit.json').read_text(encoding='utf-8'))['source_sha256'] != source_hash:
        raise ValueError('La carpeta contiene la auditoría de otro archivo. Usa una carpeta nueva.')
    frame, audit = audit_frame(read_csv(args.csv))
    audit.update(source_sha256=source_hash, filename=args.csv.name, version=VERSION)
    write_json(args.out / "audit.json", audit)
    if not audit["usable_structure"]:
        raise ValueError("La auditoría detectó problemas; revisar audit.json. No se entrena.")
    pairs = {}
    for origin in (0,3):
        part=build_pairs(frame,origin)
        pairs[str(origin)]={'pairs':len(part),'participants':int(part.study_id.nunique()),'complete_origin_features':int(part[FEATURES].notna().all(axis=1).sum())}
    write_json(args.out / "pair-counts.json", {"horizon_months": 3, "pairs_by_origin_month": pairs})
    if args.command == "audit":
        return 0
    if args.review is None:
        parser.error("Se requiere --review con alcance de uso y unidades verificados.")
    report, export = benchmark(frame, json.loads(args.review.read_text(encoding="utf-8-sig")), source_hash)
    report['evaluator_sha256']=file_hash(Path(__file__))
    report['review_sha256']=file_hash(args.review)
    write_json(args.out / "benchmark.json", report)
    if export is not None:
        write_json(args.out / "research-ridge.json", export)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
