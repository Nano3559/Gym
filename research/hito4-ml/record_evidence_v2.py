from pathlib import Path
import json
import dietfits_eval as c
root=Path.cwd(); run=root/'runs/dietfits-v2'; evidence=root/'evidence'
r=json.loads((run/'benchmark.json').read_text(encoding='utf-8'))
assert r['evaluator_sha256']==c.file_hash(root/'dietfits_eval_v2.py')
assert r['core_evaluator_sha256']==c.file_hash(root/'dietfits_eval.py')
assert r['protocol_sha256']==c.file_hash(root/'protocol-v2.json')
old=json.loads((evidence/'benchmark.json').read_text(encoding='utf-8'))
assert old['evaluator_sha256']==c.file_hash(root/'dietfits_eval.py')
assert old['split_hashes']==r['split_hashes']
for name in ['benchmark','audit','protocol']:
    (evidence/f'{name}-v2.json').write_bytes((run/f'{name}.json').read_bytes())
c.write_json(evidence/'provenance-v2.json',dict(source_sha256=c.file_hash(root/'data/raw/All_outcomes_v4.csv'),
    codebook_sha256=c.file_hash(root/'data/raw/All_outcomes_v4_CODEBOOK.csv'),
    original_research_review_sha256=c.file_hash(root/'data-review.json'),
    source_reused_from_previous_local_download=True,original_review_date='2026-10-22',
    scope='local_noncommercial_exploratory_only_no_redistribution_or_production_authorization_claimed',
    same_prior_test_partition_verified=True,legacy_evaluator_preserved=True,
    evaluator_sha256=r['evaluator_sha256'],protocol_sha256=r['protocol_sha256'],
    ridge_inference_script_sha256=c.file_hash(root/'predict-research-v2.mjs'),versions=r['versions']))
s=json.loads((evidence/'software-tests-v2.json').read_text(encoding='utf-8'))
c.write_json(evidence/'readiness-v2.json',dict(status='evaluated_exploratory_retain_existing_method',
    original_dataset_audited=True,training_executed=True,real_data_benchmark_executed=True,
    software_tests_passed=s['passed'],software_tests_skipped=s['skipped'],
    selected_model=r['selected_model'],meets_numeric_gate=r['meets_numeric_gate'],independent_test=False,
    integrate_in_app=False,application_method_retained='observed-weekly-v2',
    remaining_conditions=['No numerical improvement sufficient for adoption','Prior test already observed',
    'No application-user validation at seven days','Production and redistribution use conditions unresolved',
    'Previous Supabase migrations and remote acceptance pending']))
print('Evidencias v2 verificadas; datos originales y evaluador v1 conservados. No se reentrenó en esta verificación.')
