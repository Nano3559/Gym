import copy
from contextlib import contextmanager
import importlib.util
import json
import io
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

import numpy as np
import pandas as pd
import dietfits_eval as d
import download_source


@contextmanager
def test_folder():
    root=Path(__file__).resolve().parent/'.test-work'
    root.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(dir=root) as folder:
        if Path(folder).resolve().parent != root:
            raise RuntimeError('La carpeta de pruebas quedó fuera del espacio autorizado.')
        yield folder


def fixture(n=40):
    rows=[]
    rng=np.random.default_rng(43)
    for i in range(n):
        weight=70+rng.uniform(0,35)
        cal=1800+rng.uniform(0,1800)
        activity=25+rng.uniform(0,15)
        delta=-4+(cal-2500)*.002-(activity*weight-3000)*.001
        for code,month in d.TIME_MAP.items():
            # End-of-interval calories deliberately differ from origin features.
            rows.append(dict(study_id=f'p{i}',time=code,weight_gcrc=str(weight+delta*min(month,6)/3),cal=str(cal if month==0 else cal+900),par_kcal_kg_day=str(activity)))
    return pd.DataFrame(rows)


class AuditTests(unittest.TestCase):
    def test_schema_required(self):
        with self.assertRaises(ValueError):d.audit_frame(fixture().drop(columns='cal'))

    def test_duplicate_visits_abort(self):
        raw=fixture();frame,report=d.audit_frame(pd.concat([raw,raw.iloc[[0]]]))
        self.assertFalse(report['usable_structure'])
        with self.assertRaises(ValueError):d.build_pairs(frame,0)

    def test_unknown_time_not_guessed(self):
        raw=fixture();raw.loc[0,'time']='baseline';_,report=d.audit_frame(raw)
        self.assertEqual(report['unknown_time_values'],['baseline']);self.assertFalse(report['usable_structure'])

    def test_missing_is_not_zero(self):
        raw=fixture();raw.loc[0,'cal']='NA';raw.loc[4,'cal']='0';frame,report=d.audit_frame(raw)
        self.assertTrue(np.isnan(frame.loc[0,'cal']));self.assertEqual(frame.loc[4,'cal'],0)
        self.assertEqual(report['columns']['cal']['missing'],1)

    def test_invalid_and_outside_values(self):
        for value in ['abc','inf','-30','99999']:
            with self.subTest(value=value):
                raw=fixture();raw.loc[0,'cal']=value;_,report=d.audit_frame(raw)
                self.assertFalse(report['usable_structure'])

    def test_empty_id(self):
        raw=fixture();raw.loc[0,'study_id']='';_,report=d.audit_frame(raw)
        self.assertEqual(report['missing_ids'],1);self.assertFalse(report['usable_structure'])

    def test_no_mutation(self):
        raw=fixture();before=raw.copy(deep=True);d.audit_frame(raw);pd.testing.assert_frame_equal(raw,before)

    def test_csv_headers_and_hash(self):
        with test_folder() as folder:
            path=Path(folder)/'source.csv';path.write_text('study_id,time,time\na,b,c\n',encoding='utf-8')
            with self.assertRaises(ValueError):d.read_csv(path)
            self.assertEqual(len(d.file_hash(path)),64)

    def test_pairs_units_and_no_future_features(self):
        frame,_=d.audit_frame(fixture());pairs=d.build_pairs(frame,0)
        first=frame[(frame.study_id=='p0')&(frame.month==0)].iloc[0]
        pair=pairs[pairs.study_id=='p0'].iloc[0]
        self.assertAlmostEqual(pair.expenditure_start_kcal_day,first.weight_gcrc*first.par_kcal_kg_day)
        changed=frame.copy();changed.loc[changed.month>0,['cal','par_kcal_kg_day']]=99999
        pd.testing.assert_frame_equal(pairs[d.FEATURES],d.build_pairs(changed,0)[d.FEATURES])
        self.assertNotIn('diet',d.FEATURES);self.assertNotIn('weight_end_kg',d.FEATURES)

    def test_no_interpolated_interval(self):
        frame,_=d.audit_frame(fixture())
        with self.assertRaises(ValueError):d.build_pairs(frame,6)

    def test_missing_endpoint_excluded(self):
        raw=fixture();raw.loc[(raw.study_id=='p0')&(raw.time=='b.3'),'weight_gcrc']='NA'
        frame,_=d.audit_frame(raw);self.assertEqual(len(d.build_pairs(frame,0)),39)

    def test_no_imputation_of_target(self):
        raw=fixture();raw.loc[(raw.study_id=='p0')&(raw.time=='a.BL'),'weight_gcrc']='NA'
        frame,_=d.audit_frame(raw);self.assertEqual(len(d.build_pairs(frame,0)),39)

    def test_splits_no_people_overlap(self):
        frame,_=d.audit_frame(fixture(100));parts=d.participant_partitions(frame[frame.month==0].study_id)
        splits=d.split_pairs(d.build_pairs(frame,0),parts)
        self.assertEqual([len(splits[k]) for k in d.MIN_COUNTS],[60,15,10,15])
        self.assertEqual(parts,d.participant_partitions(list(reversed(frame[frame.month==0].study_id.tolist()))))
        temporal=d.split_pairs(d.build_pairs(frame,3),parts)
        self.assertFalse(set(splits['train'].study_id)&set(temporal['test'].study_id))

    def test_bad_split_rejected(self):
        frame,_=d.audit_frame(fixture());parts=d.participant_partitions(frame[frame.month==0].study_id)
        parts['test'].add(next(iter(parts['train'])))
        with self.assertRaises(ValueError):d.split_pairs(d.build_pairs(frame,0),parts)

    def test_review_gates_hash_and_use(self):
        with self.assertRaises(ValueError):d.verify_review({},'sha')
        review={'source_sha256':'sha','research_use_documented':True,'dictionary_and_units_verified':True,'scheduled_visits_verified':True,'permission_evidence':'test fixture only'}
        d.verify_review(review,'sha')
        for key in ['source_sha256','research_use_documented','dictionary_and_units_verified','scheduled_visits_verified','permission_evidence']:
            with self.subTest(key=key):
                changed=review.copy();changed.pop(key)
                with self.assertRaises(ValueError):d.verify_review(changed,'sha')

    def test_metrics_and_interval(self):
        result=d.metrics([80,82],[81,81],1)
        self.assertEqual(result['mae_kg'],1);self.assertEqual(result['bias_kg'],0);self.assertEqual(result['coverage'],1)
        self.assertEqual(d.metrics([],[])['mae_kg'],None)
        self.assertEqual(d.conformal_radius(np.arange(20),np.zeros(20)),18)
        with self.assertRaises(ValueError):d.conformal_radius([1,2],[1,2])

    def test_bad_metrics_rejected(self):
        for actual,prediction in [([1],[1,2]),([np.nan],[2]),([1],[np.inf])]:
            with self.assertRaises(ValueError):d.metrics(actual,prediction)
        with self.assertRaises(ValueError):d.metrics([1],[2],-1)

    def test_paired_bootstrap(self):
        report=d.paired_improvement([1,2,3],[1,2,3],[4,5,6],100)
        self.assertEqual(report['mean_mae_improvement_kg'],3)
        self.assertEqual(report['bootstrap_95_percentile_kg'],[3,3])

    def test_practical_improvement_gate(self):
        self.assertFalse(d.passes_improvement(1.95,2));self.assertTrue(d.passes_improvement(1.5,2))

    def test_status_does_not_claim_training(self):
        self.assertFalse(d.readiness()['training_executed']);self.assertFalse(d.readiness()['integrate_in_app'])

    def test_cli_audit_then_refuses_unreviewed_training(self):
        with test_folder() as folder:
            root=Path(folder);source=root/'SYNTHETIC.csv';fixture().to_csv(source,index=False)
            out=root/'audit';script=Path(d.__file__)
            command=[sys.executable,str(script),'audit','--csv',str(source),'--out',str(out)]
            completed=subprocess.run(command,capture_output=True,text=True)
            self.assertEqual(completed.returncode,0,completed.stderr)
            self.assertTrue(json.loads((out/'audit.json').read_text(encoding='utf-8'))['usable_structure'])
            d.write_json(root/'review.json',{})
            rejected=subprocess.run([sys.executable,str(script),'evaluate','--csv',str(source),'--review',str(root/'review.json'),'--out',str(out)],capture_output=True,text=True)
            self.assertNotEqual(rejected.returncode,0);self.assertFalse((out/'benchmark.json').exists())

    def test_target_changes_never_enter_features(self):
        frame,_=d.audit_frame(fixture());before=d.build_pairs(frame,0)
        frame.loc[frame.month==3,'weight_gcrc']+=2
        after=d.build_pairs(frame,0)
        pd.testing.assert_frame_equal(before[d.FEATURES],after[d.FEATURES])
        np.testing.assert_allclose(after.delta_kg-before.delta_kg,2)

    def test_download_original_preserved_and_hash_recorded(self):
        class Response(io.BytesIO):
            def geturl(self):return download_source.SOURCE
        content=fixture().to_csv(index=False).encode('utf-8')
        with test_folder() as folder:
            metadata=download_source.fetch_source(folder,lambda *a,**k:Response(content))
            self.assertEqual(metadata['sha256'],d.file_hash(Path(folder)/'All_outcomes_v4.csv'))
            self.assertFalse(metadata['license_verified']);self.assertFalse(metadata['training_executed'])
            with self.assertRaises(ValueError):download_source.fetch_source(folder,lambda *a,**k:Response(content))

    def test_download_does_not_accept_html_as_csv(self):
        with test_folder() as folder:
            with self.assertRaises(ValueError):download_source.fetch_source(folder,lambda *a,**k:io.BytesIO(b'<html>Login</html>'))
            self.assertFalse((Path(folder)/'All_outcomes_v4.csv').exists())

    @unittest.skipUnless(shutil.which('node'),'Node no disponible para paridad de investigación')
    def test_export_numpy_node_fixture_parity(self):
        model={'version':d.VERSION,'deployable':False,'horizon_months':3,'features':d.FEATURES,'imputation':[80,2000,2500],'mean':[85,2100,2600],'scale':[5,200,300],'coefficients':[.1,-.2,.3],'intercept':-3}
        rows=[[80,None,2700],[90,2400,None]]
        with test_folder() as folder:
            modelpath=Path(folder)/'model.json';rowpath=Path(folder)/'rows.json'
            d.write_json(modelpath,model);d.write_json(rowpath,rows)
            script=Path(__file__).with_name('predict-research.mjs')
            output=subprocess.check_output([shutil.which('node'),str(script),str(modelpath),str(rowpath)],text=True)
            np.testing.assert_allclose(json.loads(output),d.predict_export(model,rows),rtol=1e-12,atol=1e-12)
            self.assertEqual(d.check_javascript_export(model,rows,d.predict_export(model,rows))['status'],'passed')
            forbidden=copy.deepcopy(model);forbidden['deployable']=True;d.write_json(modelpath,forbidden)
            self.assertNotEqual(subprocess.run([shutil.which('node'),str(script),str(modelpath),str(rowpath)],capture_output=True).returncode,0)


@unittest.skipUnless(importlib.util.find_spec('sklearn'),'scikit-learn ausente: entrenamiento y paridad real NO ejecutados')
class TrainingTests(unittest.TestCase):
    def test_training_only_transforms_and_ridge_export(self):
        frame,_=d.audit_frame(fixture(400));pairs=d.build_pairs(frame,0)
        splits=d.split_pairs(pairs,d.participant_partitions(frame[frame.month==0].study_id))
        selected,_=d.fit_candidates(splits['train'],splits['validation']);model=selected[2]
        np.testing.assert_allclose(model.named_steps['impute'].statistics_,splits['train'][d.FEATURES].median().to_numpy())
        export=d.export_ridge(model)
        self.assertIsNotNone(export)
        np.testing.assert_allclose(model.predict(splits['test'][d.FEATURES]),d.predict_export(export,splits['test'][d.FEATURES]),rtol=1e-10,atol=1e-10)

    def test_full_benchmark_synthetic_not_integration(self):
        frame,_=d.audit_frame(fixture(400))
        review={'source_sha256':'SYNTHETIC','research_use_documented':True,'dictionary_and_units_verified':True,'scheduled_visits_verified':True,'permission_evidence':'Synthetic unit-test fixture; NOT DIETFITS'}
        report,_=d.benchmark(frame,review,'SYNTHETIC')
        self.assertFalse(report['integrate_in_app']);self.assertEqual(report['horizon_months'],3)
        self.assertEqual(report['test']['candidate']['count'],60)


if __name__=='__main__':
    unittest.main(verbosity=2)
