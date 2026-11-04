"""Strict software tests with synthetic fixtures; no real-data benchmark here."""
import unittest
from pathlib import Path
import dietfits_eval as core

suite=unittest.TestSuite(unittest.defaultTestLoader.loadTestsFromName(name) for name in
    ('test_dietfits_eval','test_model_governance','test_dietfits_v2'))
result=unittest.TextTestRunner(verbosity=2).run(suite)
report=dict(tests=result.testsRun,passed=result.testsRun-len(result.failures)-len(result.errors)-len(result.skipped),
    failures=len(result.failures),errors=len(result.errors),skipped=len(result.skipped),
    uses_synthetic_fixtures_only=True,real_data_benchmark_executed_by_tests=False,
    successful=result.wasSuccessful() and not result.skipped)
core.write_json(Path(__file__).parent/'evidence/software-tests-v2.json',report)
raise SystemExit(0 if report['successful'] else 1)
