"""Exploratory comparison on a previously observed test. Never authorizes deployment."""
from __future__ import annotations
import argparse
import importlib.metadata
import json
import platform
import shutil
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import Ridge
from sklearn.ensemble import HistGradientBoostingRegressor
from threadpoolctl import threadpool_limits
import dietfits_eval as core

VERSION = 'dietfits-comparison-v2'


def protocol():
    value = json.loads(Path(__file__).with_name('protocol-v2.json').read_text(encoding='utf-8-sig'))
    if (value['version'] != VERSION or value['seed'] != core.SEED or value['features'] != core.FEATURES or
        value['target']!='weight_change_kg' or value['horizon']!='scheduled_three_month_visit' or
        value['split_unit']!='participant' or value['selection']!='validation_mae_only' or
        value['calibration']!='split_conformal_90_percent' or
        value['prior_test_must_not_be_claimed_as_new_independent_evidence'] is not True or
        value['minimum_improvement_kg'] != .2 or value['minimum_relative_improvement'] != .05 or
        value['ridge_alpha'] != [.1, 1, 10, 100, 1000] or
        value['split_proportions'] != [.6, .15, .10, .15] or
        value['boosting'] != dict(estimator='HistGradientBoostingRegressor', always_compare=True,
            max_leaf_nodes=[3, 7], max_iter=100, learning_rate=.05, min_samples_leaf=20, early_stopping=False) or
        value['prior_test_already_observed'] is not True or value['production_enabled'] is not False):
        raise ValueError('El protocolo no coincide con el experimento implementado.')
    return value


def fit_candidates(train, validation):
    config = protocol()
    if train[core.FEATURES].isna().all().any():
        raise ValueError('Una entrada está completamente ausente en entrenamiento.')
    candidates = []
    for alpha in config['ridge_alpha']:
        model = Pipeline([('impute', SimpleImputer(strategy='median')), ('scale', StandardScaler()),
                          ('model', Ridge(alpha=alpha))]).fit(train[core.FEATURES], train.delta_kg)
        candidates.append((core.metrics(validation.delta_kg, model.predict(validation[core.FEATURES]))['mae_kg'],
                           f'ridge-alpha-{alpha}', model, 'ridge'))
    boost = config['boosting']
    for leaves in boost['max_leaf_nodes']:
        model = Pipeline([('impute', SimpleImputer(strategy='median')), ('model',
            HistGradientBoostingRegressor(max_leaf_nodes=leaves, max_iter=boost['max_iter'],
                learning_rate=boost['learning_rate'], min_samples_leaf=boost['min_samples_leaf'],
                early_stopping=boost['early_stopping'], random_state=config['seed']))])
        model.fit(train[core.FEATURES], train.delta_kg)
        candidates.append((core.metrics(validation.delta_kg, model.predict(validation[core.FEATURES]))['mae_kg'],
                           f'boost-leaves-{leaves}', model, 'boosting'))
    selected = min(candidates, key=lambda item: (item[0], item[1]))
    families = {family: min([c for c in candidates if c[3] == family], key=lambda c: (c[0], c[1]))
                for family in ('ridge', 'boosting')}
    selection = dict(selection='validation_only', boosting_tested=True, candidates=[
        dict(name=name, family=family, validation_mae_kg=error) for error, name, _, family in candidates])
    return selected, selection, families


def export_ridge(model):
    export = core.export_ridge(model)
    if export is not None:
        export.update(version=VERSION, training_protocol=VERSION, independent_validation=False, deployable=False)
    return export


def check_parity(export, values, expected):
    node = shutil.which('node')
    if not node:
        raise ValueError('Falta Node para comprobar equivalencia de inferencia.')
    root = Path(__file__).parent / '.test-work'
    root.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(dir=root) as folder:
        folder = Path(folder)
        core.write_json(folder / 'model.json', export)
        core.write_json(folder / 'rows.json', [[None if np.isnan(v) else float(v) for v in row]
                                              for row in np.asarray(values, dtype=float)])
        actual = np.asarray(json.loads(subprocess.check_output([node,
            str(Path(__file__).with_name('predict-research-v2.mjs')), str(folder/'model.json'),
            str(folder/'rows.json')], text=True)), dtype=float)
    if not np.allclose(actual, expected, rtol=1e-10, atol=1e-10):
        raise ValueError('La inferencia JavaScript no reproduce Ridge.')
    return dict(status='passed', max_absolute_error=float(np.max(np.abs(actual-expected))))


def benchmark(frame, review, source_hash):
    core.verify_review(review, source_hash)
    frame, audit = core.audit_frame(frame)
    if not audit['usable_structure']:
        raise ValueError('Auditoría no válida para entrenamiento.')
    primary, temporal = core.build_pairs(frame, 0), core.build_pairs(frame, 3)
    partitions = core.participant_partitions(frame.loc[frame.month == 0, 'study_id'])
    splits = core.split_pairs(primary, partitions)
    counts = {name: dict(pairs=len(part), participants=int(part.study_id.nunique())) for name, part in splits.items()}
    if any(counts[name]['participants'] < minimum for name, minimum in core.MIN_COUNTS.items()):
        raise ValueError(f'Participantes insuficientes: {counts}')
    if primary.study_id.duplicated().any():
        raise ValueError('Se requiere un par principal por participante.')
    # Limits are numerical runtime settings, not additional training inputs.
    with threadpool_limits(limits=1):
        selected, selection, families = fit_candidates(splits['train'], splits['validation'])
        _, name, model, _ = selected
        calibration, test = splits['calibration'], splits['test']
        radius = core.conformal_radius(calibration.delta_kg, model.predict(calibration[core.FEATURES]))
        actual, current = test.weight_end_kg.to_numpy(), test.weight_start_kg.to_numpy()
        prediction = current + model.predict(test[core.FEATURES])
        constant, mean = current, current + float(splits['train'].delta_kg.mean())
        comparisons = dict(constant_weight=core.metrics(actual, constant), train_mean_change=core.metrics(actual, mean),
                           candidate=core.metrics(actual, prediction, radius))
        improvement = {key: core.paired_improvement(actual, prediction, baseline)
                       for key, baseline in [('constant_weight', constant), ('train_mean_change', mean)]}
        gate = all(core.passes_improvement(comparisons['candidate']['mae_kg'], comparisons[key]['mae_kg']) and
                   improvement[key]['bootstrap_95_percentile_kg'][0] > 0 for key in improvement)
        family_results = {family: dict(model=c[1], test=core.metrics(actual, current+c[2].predict(test[core.FEATURES])))
                          for family, c in families.items()}
        later = temporal[temporal.study_id.isin(partitions['test'])]
        temporal_result = dict(origin_month=3, horizon_months=3, participants=int(later.study_id.nunique()),
                               independent_cohort=False, selected_again=False)
        if len(later):
            temporal_result.update(candidate=core.metrics(later.weight_end_kg,
                later.weight_start_kg+model.predict(later[core.FEATURES]), radius),
                constant_weight=core.metrics(later.weight_end_kg, later.weight_start_kg))
        ridge = families['ridge'][2]
        ridge_export = export_ridge(ridge)
        expected = ridge.predict(test[core.FEATURES])
        if not np.allclose(core.predict_export(ridge_export, test[core.FEATURES]), expected, rtol=1e-10, atol=1e-10):
            raise ValueError('Exportación NumPy no equivalente a Ridge.')
        parity = check_parity(ridge_export, test[core.FEATURES], expected)
    report = dict(version=VERSION, source_sha256=source_hash, horizon_months=3, origin_month=0,
        prior_test_already_observed=True, independent_test=False, evidence_type='exploratory_reused_test',
        features=core.FEATURES, split_counts=counts,
        pair_counts={str(origin):dict(pairs=len(pairs),participants=int(pairs.study_id.nunique()),
            complete_origin_features=int(pairs[core.FEATURES].notna().all(axis=1).sum()))
            for origin,pairs in [(0,primary),(3,temporal)]},
        split_hashes={k: hashlib_ids(v) for k,v in partitions.items()},
        selection=selection, selected_model=name, family_diagnostics=family_results,
        family_diagnostics_used_for_selection=False, calibration=dict(participants=len(calibration), nominal_coverage=.9, radius_kg=radius),
        test=comparisons, paired_improvements=improvement, temporal_diagnostic=temporal_result,
        meets_numeric_gate=bool(gate), research_candidate_qualifies=False, integrate_in_app=False,
        decision='retain_existing_method_requires_independent_validation', ridge_export_javascript_parity=parity,
        sprint6_comparison='not_comparable_different_horizon_and_sampling', six_month_model='not_trained',
        versions=dict(python=platform.python_version(), **{p:importlib.metadata.version(p) for p in
            ('numpy','pandas','scipy','scikit-learn','joblib','threadpoolctl')}))
    return report, ridge_export


def hashlib_ids(values):
    import hashlib
    return hashlib.sha256('\n'.join(sorted(values)).encode()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description='Comparación exploratoria v2; nunca despliega.')
    parser.add_argument('--csv', type=Path, required=True)
    parser.add_argument('--review', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--acknowledge-reused-test', action='store_true')
    args = parser.parse_args()
    if not args.acknowledge_reused_test:
        parser.error('Se requiere reconocer que el test ya fue observado: --acknowledge-reused-test')
    config = protocol()
    source_hash = core.file_hash(args.csv)
    review = json.loads(args.review.read_text(encoding='utf-8-sig'))
    core.verify_review(review, source_hash)
    if review.get('codebook_sha256'):
        codebook=args.csv.parent/'All_outcomes_v4_CODEBOOK.csv'
        if not codebook.is_file() or core.file_hash(codebook)!=review['codebook_sha256']:
            raise ValueError('Falta el diccionario verificado o su hash no coincide.')
    raw = core.read_csv(args.csv)
    _, audit = core.audit_frame(raw)
    if not audit['usable_structure']:
        raise ValueError('Auditoría no válida; no se entrena.')
    args.out.mkdir(parents=True, exist_ok=False)
    core.write_json(args.out/'protocol.json', config)
    core.write_json(args.out/'audit.json', dict(audit, source_sha256=source_hash))
    report, export = benchmark(raw, review, source_hash)
    report.update(evaluator_sha256=core.file_hash(Path(__file__)), core_evaluator_sha256=core.file_hash(Path(core.__file__)),
        protocol_sha256=core.file_hash(Path(__file__).with_name('protocol-v2.json')), review_sha256=core.file_hash(args.review))
    if core.file_hash(args.csv) != source_hash:
        raise ValueError('El original cambió durante la ejecución.')
    core.write_json(args.out/'benchmark.json', report)
    core.write_json(args.out/'research-ridge.json', export)
    print(json.dumps(dict(selected_model=report['selected_model'], mae_kg=report['test']['candidate']['mae_kg'],
        meets_numeric_gate=report['meets_numeric_gate'], independent_test=False, integrate_in_app=False), indent=2))


if __name__ == '__main__':
    main()
