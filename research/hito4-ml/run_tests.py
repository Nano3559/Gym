"""Run software tests, report skipped training explicitly, and never train on real data."""
import argparse
import json
from pathlib import Path
import unittest

parser=argparse.ArgumentParser()
parser.add_argument('--out',type=Path,default=Path(__file__).parent/'evidence'/'software-tests.json')
parser.add_argument('--require-training-tests',action='store_true')
args=parser.parse_args()
suite=unittest.defaultTestLoader.loadTestsFromName('test_dietfits_eval')
result=unittest.TextTestRunner(verbosity=2).run(suite)
report={'tests_discovered':result.testsRun,'passed':result.testsRun-len(result.failures)-len(result.errors)-len(result.skipped),
        'failures':len(result.failures),'errors':len(result.errors),'skipped':[{'test':str(test),'reason':reason} for test,reason in result.skipped],
        'uses_synthetic_fixtures_only':True,'real_data_benchmark_executed':False,
        'successful_software_tests':result.wasSuccessful(),'all_training_tests_executed':not any('TrainingTests' in str(test) for test,_ in result.skipped)}
report['strict_training_required']=args.require_training_tests
report['completion_gate_passed']=result.wasSuccessful() and (not args.require_training_tests or report['all_training_tests_executed'])
args.out.parent.mkdir(parents=True,exist_ok=True)
args.out.write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
raise SystemExit(0 if report['completion_gate_passed'] else 1)
