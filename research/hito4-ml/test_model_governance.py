import copy
import json
from pathlib import Path
import unittest
from model_governance import POLICY_VERSION, consent_allows, release_review, monitor


class GovernanceTests(unittest.TestCase):
    def candidate(self):
        c = dict.fromkeys(('research_candidate_qualifies', 'production_use_authorized',
            'app_temporal_validation', 'participant_disjoint', 'train_only_transforms',
            'no_future_features', 'consent_enforced', 'inference_parity', 'rollback_verified'), True)
        c.update(version='fixture-v1', artifact_sha256='fixture-only', data_snapshot_sha256='fixture-only',
            evaluated_at='2026-10-22T00:00:00Z', horizon_days=7, validated_horizon_days=7,
            train_people=200, validation_people=50, calibration_people=50, test_people=100,
            metrics=dict(mae_kg=.2, reference_mae_kg=.6, bias_kg=.1, coverage=.9,
                         interval_width_kg=2, paired_improvement_ci_low_kg=.1))
        return c

    def test_real_candidate_stays_rejected(self):
        b = json.loads((Path(__file__).parent/'evidence/benchmark.json').read_text())
        r = release_review(b)
        self.assertFalse(r['eligible'])
        self.assertIn('research_candidate_qualifies', r['reasons'])
        self.assertFalse(r['activates_app'])

    def test_complete_synthetic_review_does_not_activate(self):
        r = release_review(self.candidate())
        self.assertTrue(r['eligible'])
        self.assertFalse(r['activates_app'])

    def test_each_missing_requirement_blocks(self):
        for key in self.candidate():
            with self.subTest(key=key):
                c = self.candidate(); del c[key]
                self.assertFalse(release_review(c)['eligible'])

    def test_invalid_metrics_and_horizon(self):
        for patch in ({'mae_kg': float('nan')}, {'coverage': 1.1}, {'interval_width_kg': 20},
                      {'bias_kg': .6}, {'mae_kg': .59}, {'paired_improvement_ci_low_kg': 0}):
            c = self.candidate(); c['metrics'].update(patch)
            self.assertFalse(release_review(c)['eligible'])
        c = self.candidate(); c['validated_horizon_days'] = 90
        self.assertFalse(release_review(c)['eligible'])

    def test_default_denial_and_revocation(self):
        e = dict(purpose='training', at='2026-01-01T00:00:00Z', granted=True, policy_version=POLICY_VERSION)
        self.assertFalse(consent_allows([], 'training', e['at']))
        self.assertTrue(consent_allows([e], 'training', e['at']))
        self.assertFalse(consent_allows([e], 'inference', e['at']))
        revoke = dict(e, at='2026-02-01T00:00:00Z', granted=False)
        self.assertFalse(consent_allows([e, revoke], 'training', revoke['at']))
        self.assertTrue(consent_allows([e, revoke], 'training', e['at']))
        self.assertFalse(consent_allows([e, dict(e, granted=False)], 'training', e['at']))
        self.assertFalse(consent_allows([dict(e, policy_version='old')], 'training', e['at']))

    def rows(self):
        return [dict(person=str(i), version='fixture-v1', horizon_days=7,
            issued_at='2026-01-01T00:00:00Z', target_at='2026-01-08T00:00:00Z',
            observed_at='2026-01-08T00:00:00Z', predicted_kg=80.1, actual_kg=80,
            reference_kg=81, lower_kg=79, upper_kg=81) for i in range(30)]

    def test_healthy_monitor(self):
        r = monitor(self.rows(), version='fixture-v1', horizon_days=7)
        self.assertEqual(r['action'], 'continue_review')
        self.assertAlmostEqual(r['mae_kg'], .1)

    def test_insufficient_people_duplicates_and_other_versions(self):
        rows = self.rows()[:29]
        self.assertEqual(monitor(rows*5, version='fixture-v1', horizon_days=7)['action'], 'fallback')
        self.assertEqual(monitor(self.rows(), version='other', horizon_days=7)['people'], 0)
        self.assertEqual(monitor(self.rows(), version='fixture-v1', horizon_days=90)['people'], 0)

    def test_monitor_degradation_and_bad_evidence(self):
        for patch in ({'predicted_kg': 81}, {'actual_kg': 82}, {'actual_kg': float('inf')},
                      {'observed_at': '2025-01-01T00:00:00Z'}, {'lower_kg': 82}, {'upper_kg': 100}):
            rows = copy.deepcopy(self.rows())
            for r in rows: r.update(patch)
            self.assertEqual(monitor(rows, version='fixture-v1', horizon_days=7)['action'], 'fallback')


if __name__ == '__main__':
    unittest.main(verbosity=2)
