"""Offline release review only. Never loads users, trains, or switches the app."""
import json
import math
from pathlib import Path

POLICY_VERSION = 'model-governance-v1'
FALLBACK_VERSION = 'observed-weekly-v1'


def consent_allows(events, purpose, at):
    """ISO UTC instants; latest event wins, including revocations. Default denied."""
    relevant = [e for e in events if e['purpose'] == purpose and e['at'] <= at]
    if not relevant:
        return False
    latest = max(e['at'] for e in relevant)
    return all(e.get('granted') is True and e.get('policy_version') == POLICY_VERSION
               for e in relevant if e['at'] == latest)


def release_review(candidate):
    """Missing, unmeasured, incompatible or insufficient evidence blocks release."""
    reasons = []
    for flag in ('research_candidate_qualifies', 'production_use_authorized',
                 'app_temporal_validation', 'participant_disjoint',
                 'train_only_transforms', 'no_future_features',
                 'consent_enforced', 'inference_parity', 'rollback_verified'):
        if candidate.get(flag) is not True:
            reasons.append(flag)
    for name in ('version', 'artifact_sha256', 'data_snapshot_sha256', 'evaluated_at'):
        if not isinstance(candidate.get(name), str) or not candidate[name].strip():
            reasons.append(name)
    if candidate.get('horizon_days') != candidate.get('validated_horizon_days') or not candidate.get('horizon_days'):
        reasons.append('horizon')
    # Initial engineering thresholds, not clinically validated limits.
    limits = {'train_people': 200, 'validation_people': 50,
              'calibration_people': 50, 'test_people': 100}
    for name, minimum in limits.items():
        value = candidate.get(name)
        if type(value) is not int or value < minimum:
            reasons.append(name)
    metrics = candidate.get('metrics', {})
    names = ('mae_kg', 'reference_mae_kg', 'bias_kg', 'coverage',
             'interval_width_kg', 'paired_improvement_ci_low_kg')
    if any(type(metrics.get(n)) not in (int, float) or not math.isfinite(metrics[n]) for n in names):
        reasons.append('metrics_missing_or_invalid')
    else:
        m = metrics
        if min(m['mae_kg'], m['reference_mae_kg']) < 0 or m['reference_mae_kg'] - m['mae_kg'] < max(.2, .05 * m['reference_mae_kg']) or m['paired_improvement_ci_low_kg'] <= 0:
            reasons.append('improvement')
        if abs(m['bias_kg']) > .5:
            reasons.append('bias')
        if not .85 <= m['coverage'] <= 1 or not 0 < m['interval_width_kg'] <= 4:
            reasons.append('interval')
    return {'policy_version': POLICY_VERSION, 'eligible': not reasons,
            'reasons': reasons, 'fallback_version': FALLBACK_VERSION,
            'activates_app': False}


def monitor(rows, *, version, horizon_days):
    """One latest matured forecast per person; callers supply frozen outcomes.

    Schema: person, version, horizon_days, issued_at, target_at, observed_at,
    predicted_kg, actual_kg, reference_kg, lower_kg, upper_kg. ISO UTC times.
    """
    latest = {}
    try:
        for r in rows:
            if r['version'] != version or r['horizon_days'] != horizon_days:
                continue
            if not r['issued_at'] < r['target_at'] <= r['observed_at']:
                raise ValueError('unmatured_or_invalid_time')
            for key in ('predicted_kg', 'actual_kg', 'reference_kg', 'lower_kg', 'upper_kg'):
                if type(r[key]) not in (int, float) or not math.isfinite(r[key]):
                    raise ValueError('invalid_numeric')
            if not r['lower_kg'] <= r['predicted_kg'] <= r['upper_kg']:
                raise ValueError('invalid_interval')
            if r['person'] not in latest or latest[r['person']]['issued_at'] < r['issued_at']:
                latest[r['person']] = r
    except (KeyError, TypeError, ValueError):
        return {'action': 'fallback', 'reason': 'invalid_evidence', 'fallback_version': FALLBACK_VERSION}
    values = list(latest.values())
    if len(values) < 30:
        return {'action': 'fallback', 'reason': 'insufficient_people', 'people': len(values), 'fallback_version': FALLBACK_VERSION}
    n = len(values)
    mae = sum(abs(r['predicted_kg'] - r['actual_kg']) for r in values) / n
    reference = sum(abs(r['reference_kg'] - r['actual_kg']) for r in values) / n
    bias = sum(r['predicted_kg'] - r['actual_kg'] for r in values) / n
    coverage = sum(r['lower_kg'] <= r['actual_kg'] <= r['upper_kg'] for r in values) / n
    width = sum(r['upper_kg'] - r['lower_kg'] for r in values) / n
    degraded = mae >= reference or abs(bias) > .5 or coverage < .85 or width > 4
    return {'action': 'fallback' if degraded else 'continue_review', 'people': n,
            'mae_kg': mae, 'reference_mae_kg': reference, 'bias_kg': bias,
            'coverage': coverage, 'interval_width_kg': width, 'fallback_version': FALLBACK_VERSION}


if __name__ == '__main__':
    root = Path(__file__).parent
    result = release_review(json.loads((root / 'evidence/benchmark.json').read_text(encoding='utf-8')))
    (root / 'evidence/governance-review.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result, indent=2))
