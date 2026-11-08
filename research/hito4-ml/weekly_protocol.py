"""Prospective weekly research. Offline only; never enables production inference."""
from __future__ import annotations
import argparse
import hashlib
import json
import math
import importlib.metadata
from datetime import datetime, timedelta, time, timezone
from pathlib import Path
from statistics import median, pstdev
from zoneinfo import ZoneInfo
import numpy as np

VERSION = 'weekly-pilot-v1'
POLICY = 'weekly-consent-v1'
FEATURES = ['weight_anchor_kg', 'trend_kg_week', 'intake_mean_kcal', 'expenditure_mean_kcal', 'weight_sd_kg']
UNITS = ['kg', 'kg/week', 'kcal/day', 'kcal/day', 'kg']
MINIMA = dict(train=200, validation=50, calibration=50, test=100)


def instant(value):
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if result.tzinfo is None:
        raise ValueError('Timezone required')
    return result


def finite(value):
    return type(value) in (int, float) and math.isfinite(value)


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()).hexdigest()


def grant_at(events, purpose, at):
    eligible = [e for e in events if e['purpose'] == purpose and instant(e['at']) <= at]
    if not eligible:
        return None
    stamp = max(instant(e['at']) for e in eligible)
    latest = [e for e in eligible if instant(e['at']) == stamp]
    # Ambiguous simultaneous events fail closed instead of depending on UUID order.
    return latest[0]['id'] if len(latest) == 1 and latest[0]['granted'] is True and latest[0]['policy_version'] == POLICY else None


def features_at_issue(packet, entry):
    """Extract only frozen past inputs. Does not access outcome weight records."""
    if packet.get('format') != 'weekly-research-export-v1' or packet.get('policy_version') != POLICY or packet.get('purpose') not in ('training', 'evaluation') or not packet.get('participant_id'):
        raise ValueError('Invalid export contract')
    issued, exported = instant(entry['issued_at']), instant(packet['exported_at'])
    if exported < issued:
        raise ValueError('Future issue')
    for at in (issued, exported):
        if grant_at(packet['consents'], packet['purpose'], at) != entry['consent_id']:
            raise ValueError('Consent missing, withdrawn or replaced')
    scope = entry['scope']
    if not finite(scope.get('age_at_issue')) or not 19 <= scope['age_at_issue'] <= 59 or scope.get('estimates_paused') is not False or scope.get('activity_level') not in ('sedentary', 'light', 'moderate', 'high') or scope.get('formula_sex') not in ('female', 'male'):
        raise ValueError('Unsupported population')
    text = entry['canonical_inputs_text']
    snapshot = entry['frozen_inputs']
    if hashlib.sha256(text.encode()).hexdigest() != entry['inputs_sha256'] or json.loads(text) != snapshot:
        raise ValueError('Frozen input integrity')
    zone = ZoneInfo(snapshot['timezone'])
    day = issued.astimezone(zone).date()
    as_of = datetime.fromisoformat(snapshot['asOf']).date()
    if snapshot.get('version') != 'observed-weekly-v2' or snapshot.get('ready') is not True or as_of != day - timedelta(days=1):
        raise ValueError('Incompatible baseline or cut')
    inputs = snapshot['inputs']
    calculated = instant(inputs['calculatedAt'])
    if not issued - timedelta(hours=1) <= calculated <= issued:
        raise ValueError('Stale or future input')
    expected = [as_of - timedelta(days=27-i) for i in range(28)]
    balance = inputs['balance']
    if len(balance) != 28 or sorted(r['day'] for r in balance) != [d.isoformat() for d in expected]:
        raise ValueError('Incomplete or duplicate closed days')
    for row in balance:
        if row.get('eligible') is not True or not finite(row.get('intake')) or row['intake'] < 0 or not finite(row.get('expenditure')) or row['expenditure'] <= 0:
            raise ValueError('Missing energy is not zero')
    daily = {}
    for row in inputs['weights']:
        measured = instant(row['measured_at'])
        date = measured.astimezone(zone).date()
        if measured > calculated or not finite(row.get('weight_kg')) or not 20 <= row['weight_kg'] <= 500:
            raise ValueError('Future or invalid feature weight')
        if expected[0] <= date <= as_of:
            daily.setdefault(date, []).append(row['weight_kg'])
    daily = {d: median(v) for d, v in daily.items()}
    weeks = [[v for d, v in daily.items() if expected[7*i] <= d <= expected[7*i+6]] for i in range(4)]
    if any(len(w) < 3 for w in weeks) or (as_of-max(daily, default=expected[0])).days > 2:
        raise ValueError('Insufficient distinct weight days')
    medians = [median(w) for w in weeks]
    if any(abs(medians[i+1]-medians[i]) > .7+1e-9 for i in range(3)):
        raise ValueError('Weekly change outside baseline scope')
    trend = median([medians[i+1]-medians[i] for i in range(3)])
    features = [medians[-1], trend, sum(r['intake'] for r in balance)/28, sum(r['expenditure'] for r in balance)/28, pstdev(daily.values())]
    slope = snapshot.get('slope')
    if not finite(slope) or abs(slope) > .1:
        raise ValueError('Invalid frozen trend')
    return dict(person=packet['participant_id'], entry_id=entry['id'], issued_at=issued.isoformat(),
                features=features, persistence_kg=features[0], trend_kg=features[0]+slope*((day-as_of).days+7),
                scope=scope, inputs_sha256=entry['inputs_sha256'])


def example(packet, entry):
    """One frozen 28-day feature window and a real, matured day-6..8 outcome."""
    result = features_at_issue(packet, entry)
    issued, exported = instant(entry['issued_at']), instant(packet['exported_at'])
    zone = ZoneInfo(entry['frozen_inputs']['timezone'])
    day = issued.astimezone(zone).date()
    end = datetime.combine(day+timedelta(days=9), time(), zone)
    if exported < end:
        raise ValueError('Outcome window not matured')
    outcome, available = {}, end
    for row in packet['weights']:
        measured = instant(row['measured_at'])
        date = measured.astimezone(zone).date()
        if day+timedelta(days=6) <= date <= day+timedelta(days=8):
            recorded = max(instant(row['created_at']), instant(row['updated_at']))
            if measured > exported or recorded > exported or instant(row['created_at']) < measured or instant(row['updated_at']) < instant(row['created_at']) or not finite(row.get('weight_kg')) or not 20 <= row['weight_kg'] <= 500:
                raise ValueError('Invalid or future outcome')
            available = max(available, recorded)
            outcome.setdefault(date, []).append(row['weight_kg'])
    if len(outcome) < 2:
        raise ValueError('Two distinct outcome days required')
    actual = median([median(v) for v in outcome.values()])
    result.update(available_at=available.isoformat(), actual_kg=actual, delta_kg=actual-result['features'][0], outcome_days=sorted(d.isoformat() for d in outcome))
    return result


def build(packets, purpose):
    rows, excluded, people = [], [], set()
    for packet in packets:
        person = packet.get('participant_id')
        if person in people:
            raise ValueError('Use one latest export per person; do not combine stale consent receipts')
        people.add(person)
        if packet.get('purpose') != purpose:
            raise ValueError('Wrong purpose')
        for entry in packet.get('entries', []):
            try:
                rows.append(example(packet, entry))
            except (ValueError, KeyError, TypeError) as error:
                excluded.append(dict(entry_id=entry.get('id'), reason=str(error)))
    return rows, excluded


def partition(person):
    value = int(hashlib.sha256(f'407:{person}'.encode()).hexdigest(), 16) / 2**256
    return 'train' if value < .6 else 'validation' if value < .75 else 'calibration' if value < .85 else 'test'


def split_rows(rows, fit_cutoff, test_start):
    cutoff, start = instant(fit_cutoff), instant(test_start)
    if start <= cutoff:
        raise ValueError('Test must start strictly after fitting cutoff')
    latest = {}
    for row in rows:
        group = partition(row['person'])
        if not instant(row['issued_at']) < instant(row['available_at']):
            raise ValueError('Invalid temporal label')
        if (group == 'test' and instant(row['issued_at']) >= start) or (group != 'test' and instant(row['available_at']) <= cutoff):
            if row['person'] not in latest or row['issued_at'] > latest[row['person']]['issued_at']:
                latest[row['person']] = row
    groups = {name: [r for r in latest.values() if partition(r['person']) == name] for name in MINIMA}
    return groups


def conformal(errors):
    rank = math.ceil((len(errors)+1)*.9)
    if rank > len(errors) or not len(errors):
        raise ValueError('Insufficient calibration')
    return float(sorted(errors)[rank-1])


def stats(actual, predicted, radius):
    a, p = np.asarray(actual), np.asarray(predicted)
    return dict(mae_kg=float(np.mean(abs(p-a))), rmse_kg=float(np.sqrt(np.mean((p-a)**2))), bias_kg=float(np.mean(p-a)), coverage=float(np.mean(abs(p-a)<=radius)), interval_width_kg=float(2*radius))


def improvement(actual, predicted, reference):
    difference = abs(np.asarray(reference)-actual)-abs(np.asarray(predicted)-actual)
    rng = np.random.default_rng(407)
    samples = np.asarray([rng.choice(difference, len(difference), replace=True).mean() for _ in range(2000)])
    return [float(v) for v in np.quantile(samples, [.025, .975])]


def adoption(metrics):
    names = ['mae_kg', 'reference_mae_kg', 'bias_kg', 'coverage', 'interval_width_kg', 'paired_improvement_ci_low_kg']
    if any(not finite(metrics.get(k)) for k in names):
        return False
    m = metrics
    return (m['mae_kg'] >= 0 and m['reference_mae_kg']-m['mae_kg'] >= max(.2, .05*m['reference_mae_kg']) and m['paired_improvement_ci_low_kg'] > 0
            and abs(m['bias_kg']) <= .5 and .85 <= m['coverage'] <= 1 and 0 < m['interval_width_kg'] <= 4)


def fit_candidates(groups):
    from sklearn.pipeline import Pipeline
    from sklearn.impute import SimpleImputer
    from sklearn.preprocessing import StandardScaler
    from sklearn.linear_model import Ridge
    from sklearn.ensemble import HistGradientBoostingRegressor
    train, validation = groups['train'], groups['validation']
    x, y = np.asarray([r['features'] for r in train]), np.asarray([r['delta_kg'] for r in train])
    vx, vy = np.asarray([r['features'] for r in validation]), np.asarray([r['delta_kg'] for r in validation])
    candidates = []
    for alpha in [.1, 1, 10, 100, 1000]:
        model = Pipeline([('impute', SimpleImputer(strategy='median')), ('scale', StandardScaler()), ('model', Ridge(alpha=alpha))]).fit(x, y)
        candidates.append((float(np.mean(abs(model.predict(vx)-vy))), f'ridge-{alpha}', model))
    for leaves in [3, 7]:
        model = Pipeline([('impute', SimpleImputer(strategy='median')), ('model', HistGradientBoostingRegressor(max_leaf_nodes=leaves, max_iter=100, learning_rate=.05, min_samples_leaf=20, early_stopping=False, random_state=407))]).fit(x, y)
        candidates.append((float(np.mean(abs(model.predict(vx)-vy))), f'boosting-{leaves}', model))
    return min(candidates, key=lambda c: (c[0], c[1])), [dict(validation_mae_kg=c[0], name=c[1]) for c in candidates]


def ridge_export(model, rows, radius):
    x = np.asarray([r['features'] for r in rows])
    return dict(format='weekly-ridge-v1', horizon_days=7, features=FEATURES, units=UNITS,
                imputation=model['impute'].statistics_.tolist(), means=model['scale'].mean_.tolist(), scales=model['scale'].scale_.tolist(),
                coefficients=model['model'].coef_.tolist(), intercept=float(model['model'].intercept_), radius_kg=radius,
                minimum=x.min(axis=0).tolist(), maximum=x.max(axis=0).tolist(), deployable=False)


def train(rows, manifest, output):
    """Exclusive run directory + test-opened marker; never overwrite a test evaluation."""
    if set(manifest) != {'version', 'fit_cutoff', 'test_start', 'data_sha256', 'code_sha256'} or manifest['version'] != VERSION or manifest['data_sha256'] != digest(rows) or manifest['code_sha256'] != hashlib.sha256(Path(__file__).read_bytes()).hexdigest():
        raise ValueError('Freeze exact data, code and cutoffs before training')
    groups = split_rows(rows, manifest['fit_cutoff'], manifest['test_start'])
    counts = {k: len(v) for k, v in groups.items()}
    output = Path(output)
    output.mkdir(parents=True, exist_ok=False)
    (output/'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    report = dict(version=VERSION, people=counts, deployable=False, activates_app=False, fallback='observed-weekly-v2', status='insufficient_real_weekly_data',
                  horizon_days=7, outcome_window_days=[6,8], features=FEATURES, units=UNITS, predecessor=None, approval=None,
                  data_sha256=manifest['data_sha256'], code_sha256=manifest['code_sha256'], protocol_sha256=digest(manifest),
                  dependencies={name:importlib.metadata.version(name) for name in ('scikit-learn','numpy','scipy')})
    if any(counts[k] < n for k, n in MINIMA.items()):
        (output/'review.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
        return report
    from threadpoolctl import threadpool_limits
    with threadpool_limits(limits=1):
        (_, name, model), candidates = fit_candidates(groups)
        calibration, test = groups['calibration'], groups['test']
        radius = conformal(abs(model.predict([r['features'] for r in calibration])-[r['delta_kg'] for r in calibration]))
        # Marker is persisted BEFORE opening the reserved test, including failed runs.
        (output/'test-opened.lock').write_text(manifest['data_sha256'], encoding='utf-8')
        predicted = model.predict([r['features'] for r in test])+[r['features'][0] for r in test]
    actual = np.asarray([r['actual_kg'] for r in test])
    mean_change = float(np.mean([r['delta_kg'] for r in groups['train']]))
    references = dict(persistence=np.asarray([r['persistence_kg'] for r in test]), trend=np.asarray([r['trend_kg'] for r in test]), mean_change=np.asarray([r['features'][0]+mean_change for r in test]))
    reference = min(references, key=lambda k: float(np.mean(abs(references[k]-actual))))
    metrics = stats(actual, predicted, radius)
    metrics.update(reference_mae_kg=float(np.mean(abs(references[reference]-actual))), paired_improvement_ci_low_kg=improvement(actual,predicted,references[reference])[0])
    subgroups = {}
    for i, row in enumerate(test):
        scope = row['scope']
        key = f"{int(scope['age_at_issue'])//10*10}:{scope['formula_sex']}:{scope['activity_level']}"
        subgroups.setdefault(key, []).append(i)
    subgroup_metrics = {k: dict(people=len(indices), **stats(actual[indices],predicted[indices],radius)) for k, indices in subgroups.items()}
    subgroup_ok = all(v['people'] >= 20 and abs(v['bias_kg']) <= .5 and v['coverage'] >= .85 for v in subgroup_metrics.values())
    report.update(status='research_review_only', candidate=name, candidates=candidates, metrics=metrics, reference=reference, references_mae_kg={k:float(np.mean(abs(v-actual))) for k,v in references.items()}, subgroups=subgroup_metrics,
                  numerical_criteria_pass=adoption(metrics) and subgroup_ok, pending=['prospective_shadow_pilot','independent_approval','production_inference_validation','withdrawal_from_downloaded_datasets'])
    if name.startswith('ridge'):
        artifact = ridge_export(model, groups['train'], radius)
        artifact.update(version=f'{VERSION}-{digest(manifest)[:16]}', manifest=manifest, evaluated_subgroups=subgroup_metrics, created_at=datetime.now(timezone.utc).isoformat())
        (output/'ridge.json').write_text(json.dumps(artifact, indent=2), encoding='utf-8')
        report['artifact_sha256'] = hashlib.sha256((output/'ridge.json').read_bytes()).hexdigest()
    else:
        report['pending'].append('boosting_inference_service_not_deployed')
    (output/'review.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    return report


def monitor(rows, version, now, was_suspended=False):
    """Recent matured observations; never automatically reactivate a suspended model."""
    latest = {}
    try:
        now = instant(now)
        for row in rows:
            if row['version'] != version or row['horizon_days'] != 7:
                continue
            if not instant(row['issued_at']) < instant(row['target_at']) <= instant(row['observed_at']) <= now or instant(row['observed_at']) < now-timedelta(days=35):
                continue
            if any(not finite(row.get(k)) for k in ('predicted_kg','actual_kg','reference_kg','lower_kg','upper_kg')) or not row['lower_kg'] <= row['predicted_kg'] <= row['upper_kg']:
                raise ValueError('Invalid observation')
            if row['person'] not in latest or instant(row['issued_at']) > instant(latest[row['person']]['issued_at']):
                latest[row['person']] = row
        values = list(latest.values())
        if len(values) < 30:
            raise ValueError('At least 30 recent people required')
        actual, predicted, reference = [np.asarray([r[k] for r in values]) for k in ('actual_kg','predicted_kg','reference_kg')]
        metrics = dict(mae_kg=float(np.mean(abs(predicted-actual))), reference_mae_kg=float(np.mean(abs(reference-actual))), bias_kg=float(np.mean(predicted-actual)), coverage=float(np.mean([r['lower_kg']<=r['actual_kg']<=r['upper_kg'] for r in values])), interval_width_kg=float(np.mean([r['upper_kg']-r['lower_kg'] for r in values])))
        healthy = metrics['mae_kg'] < metrics['reference_mae_kg'] and abs(metrics['bias_kg'])<=.5 and metrics['coverage']>=.85 and 0<metrics['interval_width_kg']<=4
        return dict(action=('approval_required' if was_suspended else 'continue_review') if healthy else 'fallback', people=len(values), metrics=metrics, improvement_ci_95=improvement(actual,predicted,reference), fallback='observed-weekly-v2', activates_app=False)
    except (KeyError, ValueError, TypeError) as error:
        return dict(action='fallback', reason=str(error), fallback='observed-weekly-v2', activates_app=False)


def register_shadow(directory, *, person, version, frozen_inputs, prediction, issued_at, now, evaluation_grant):
    """Local prospective receipt only. No outcomes, no production replacement."""
    issued, current = instant(issued_at), instant(now)
    if not evaluation_grant or not version.startswith(VERSION+'-') or not person or not issued <= current <= issued+timedelta(hours=1):
        raise ValueError('Fresh issue and current evaluation consent required')
    if set(prediction) != {'predicted_kg','lower_kg','upper_kg'} or any(not finite(v) for v in prediction.values()) or not prediction['lower_kg'] <= prediction['predicted_kg'] <= prediction['upper_kg']:
        raise ValueError('Invalid shadow prediction')
    receipt = dict(person=person, version=version, horizon_days=7, issued_at=issued.isoformat(),
                   inputs_sha256=digest(frozen_inputs), frozen_inputs=frozen_inputs, prediction=prediction,
                   evaluation_grant=evaluation_grant, recorded_at=current.isoformat(), production=False)
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    path = directory/(digest(dict(person=person,version=version,issued_at=issued.isoformat()))+'.json')
    with path.open('x', encoding='utf-8') as handle:
        json.dump(receipt, handle, indent=2, allow_nan=False)
    return path


def shadow_predict(directory, artifact, packet, entry, now):
    """Prospective Ridge-only research path with frozen features and evaluated scope."""
    if packet.get('purpose') != 'evaluation' or instant(packet['exported_at']) > instant(now):
        raise ValueError('Current evaluation export required')
    row = features_at_issue(packet, entry)
    if artifact.get('format') != 'weekly-ridge-v1' or artifact.get('features') != FEATURES or artifact.get('units') != UNITS or artifact.get('horizon_days') != 7 or artifact.get('deployable') is not False:
        raise ValueError('Incompatible shadow artifact')
    if not instant(artifact['created_at']) <= instant(row['issued_at']) or not instant(artifact['manifest']['fit_cutoff']) < instant(row['issued_at']):
        raise ValueError('Model must predate the prospective issue')
    scope = row['scope']
    key = f"{int(scope['age_at_issue'])//10*10}:{scope['formula_sex']}:{scope['activity_level']}"
    group = artifact.get('evaluated_subgroups', {}).get(key, {})
    if group.get('people', 0) < 20 or not finite(group.get('bias_kg')) or abs(group['bias_kg']) > .5 or not finite(group.get('coverage')) or group['coverage'] < .85:
        raise ValueError('Population not adequately evaluated')
    for name in ('means','scales','coefficients','minimum','maximum'):
        if len(artifact[name]) != 5 or any(not finite(v) for v in artifact[name]):
            raise ValueError('Invalid parameters')
    if any(v<=0 for v in artifact['scales']) or any(not lo<=v<=hi for v,lo,hi in zip(row['features'],artifact['minimum'],artifact['maximum'])):
        raise ValueError('Outside evaluated range')
    if not finite(artifact.get('radius_kg')) or not 0 < artifact['radius_kg'] <= 2 or not finite(artifact.get('intercept')):
        raise ValueError('Invalid calibrated interval')
    predicted = row['features'][0]+artifact['intercept']+sum(c*(v-m)/s for c,v,m,s in zip(artifact['coefficients'],row['features'],artifact['means'],artifact['scales']))
    if not finite(predicted) or not 20 <= predicted <= 500:
        raise ValueError('Invalid prediction')
    frozen = dict(entry=entry,artifact_sha256=digest(artifact),reference_kg=row['trend_kg'])
    return register_shadow(directory,person=row['person'],version=artifact['version'],frozen_inputs=frozen,
        prediction=dict(predicted_kg=predicted,lower_kg=predicted-artifact['radius_kg'],upper_kg=predicted+artifact['radius_kg']),
        issued_at=row['issued_at'],now=now,evaluation_grant=entry['consent_id'])


def monthly_review(last_review, now, new_people, authorized):
    return instant(now)-instant(last_review) >= timedelta(days=30) and type(new_people) is int and new_people >= 30 and authorized is True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--exports', type=Path, required=True)
    parser.add_argument('--manifest', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    packets = [json.loads(p.read_text(encoding='utf-8')) for p in sorted(args.exports.glob('*.json'))]
    rows, excluded = build(packets, 'training')
    result = train(rows, json.loads(args.manifest.read_text(encoding='utf-8')), args.output)
    (args.output/'exclusions.json').write_text(json.dumps(excluded,indent=2),encoding='utf-8')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
