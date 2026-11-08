"""Software validation with synthetic fixtures. Does not train on real users."""
import json
import unittest
from pathlib import Path
suite=unittest.TestSuite(unittest.defaultTestLoader.loadTestsFromName(name) for name in
    ('test_dietfits_eval','test_model_governance','test_dietfits_v2','test_weekly_protocol'))
result=unittest.TextTestRunner(verbosity=2).run(suite)
report=dict(tests=result.testsRun,passed=result.testsRun-len(result.failures)-len(result.errors)-len(result.skipped),failures=len(result.failures),errors=len(result.errors),skipped=len(result.skipped),
    synthetic_only=True,real_pilot_executed=False,production_model_enabled=False,successful=result.wasSuccessful() and not result.skipped)
Path(__file__).with_name('evidence').joinpath('software-tests-weekly.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
raise SystemExit(0 if report['successful'] else 1)
