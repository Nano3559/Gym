import copy
import json
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch
import numpy as np
from threadpoolctl import threadpool_limits
import dietfits_eval as core
import dietfits_eval_v2 as v2
from test_dietfits_eval import fixture, test_folder


class ComparisonV2Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.raw=fixture(400)
        frame,_=core.audit_frame(cls.raw)
        cls.splits=core.split_pairs(core.build_pairs(frame,0),core.participant_partitions(frame[frame.month==0].study_id))
        with threadpool_limits(limits=1):
            cls.selected,cls.selection,cls.families=v2.fit_candidates(cls.splits['train'],cls.splits['validation'])

    def review(self, source_hash='SYNTHETIC'):
        return dict(source_sha256=source_hash,research_use_documented=True,dictionary_and_units_verified=True,
            scheduled_visits_verified=True,permission_evidence='Synthetic fixture only, not authorization for a real dataset')

    def test_both_families_always_trained(self):
        candidates=self.selection['candidates']
        self.assertEqual(len(candidates),7)
        self.assertEqual(sum(c['family']=='ridge' for c in candidates),5)
        self.assertEqual(sum(c['family']=='boosting' for c in candidates),2)
        self.assertEqual(self.selected[0],min(c['validation_mae_kg'] for c in candidates))
        self.assertEqual(self.selection['selection'],'validation_only')

    def test_transforms_fit_only_on_train(self):
        for family in self.families.values():
            np.testing.assert_allclose(family[2].named_steps['impute'].statistics_,self.splits['train'][core.FEATURES].median())
        ridge=self.families['ridge'][2]
        values=self.splits['train'][core.FEATURES].fillna(self.splits['train'][core.FEATURES].median())
        np.testing.assert_allclose(ridge.named_steps['scale'].mean_,values.mean())
        self.assertNotIn('scale',self.families['boosting'][2].named_steps)

    def test_zero_improvement_still_compares_boosting(self):
        train=self.splits['train'].copy();validation=self.splits['validation'].copy()
        train.delta_kg=0.;validation.delta_kg=0.
        with threadpool_limits(limits=1):
            _,selection,_=v2.fit_candidates(train,validation)
        self.assertTrue(selection['boosting_tested'])
        self.assertEqual(len(selection['candidates']),7)

    def test_end_to_end_never_promotes_reused_test(self):
        before=self.raw.copy(deep=True)
        report,export=v2.benchmark(self.raw,self.review(),'SYNTHETIC')
        self.assertFalse(report['independent_test'])
        self.assertFalse(report['research_candidate_qualifies'])
        self.assertFalse(report['integrate_in_app'])
        self.assertEqual(report['test']['candidate']['count'],60)
        self.assertEqual(set(report['family_diagnostics']),{'ridge','boosting'})
        self.assertFalse(report['family_diagnostics_used_for_selection'])
        self.assertFalse(report['temporal_diagnostic']['independent_cohort'])
        self.assertFalse(report['temporal_diagnostic']['selected_again'])
        self.assertEqual(report['ridge_export_javascript_parity']['status'],'passed')
        self.assertFalse(export['deployable'])
        import pandas as pd
        pd.testing.assert_frame_equal(before,self.raw)

    def test_insufficient_people_rejected(self):
        with self.assertRaisesRegex(ValueError,'Participantes insuficientes'):
            v2.benchmark(fixture(40),self.review(),'SYNTHETIC')

    def test_invalid_audit_rejected(self):
        duplicate=self.raw.iloc[[0]]
        import pandas as pd
        with self.assertRaisesRegex(ValueError,'Auditoría'):
            v2.benchmark(pd.concat([self.raw,duplicate]),self.review(),'SYNTHETIC')

    def test_protocol_change_is_not_silent(self):
        config=v2.protocol();config['minimum_improvement_kg']=0
        with patch.object(Path,'read_text',return_value=json.dumps(config)):
            with self.assertRaisesRegex(ValueError,'protocolo'):
                v2.protocol()

    def test_numpy_and_javascript_parity_with_missing_inputs(self):
        model=self.families['ridge'][2]
        export=v2.export_ridge(model)
        values=self.splits['test'][core.FEATURES].iloc[:5].copy()
        values.iloc[0,1]=np.nan;values.iloc[1,2]=np.nan
        expected=model.predict(values)
        np.testing.assert_allclose(core.predict_export(export,values),expected,rtol=1e-10,atol=1e-10)
        self.assertEqual(v2.check_parity(export,values,expected)['status'],'passed')
        with test_folder() as folder:
            root=Path(folder);bad=copy.deepcopy(export);bad['deployable']=True
            core.write_json(root/'model.json',bad);core.write_json(root/'rows.json',[[80,None,2500]])
            run=subprocess.run(['node',str(Path(v2.__file__).with_name('predict-research-v2.mjs')),
                str(root/'model.json'),str(root/'rows.json')],capture_output=True)
            self.assertNotEqual(run.returncode,0)

    def test_cli_requires_acknowledgement_and_refuses_overwrite(self):
        with test_folder() as folder:
            root=Path(folder);source=root/'SYNTHETIC.csv';self.raw.to_csv(source,index=False)
            review=root/'review.json';core.write_json(review,self.review(core.file_hash(source)))
            out=root/'existing';out.mkdir();(out/'sentinel.txt').write_text('preserve')
            command=[sys.executable,str(Path(v2.__file__)),'--csv',str(source),'--review',str(review),'--out',str(out)]
            refused=subprocess.run(command,capture_output=True,text=True)
            self.assertNotEqual(refused.returncode,0)
            self.assertIn('acknowledge-reused-test',refused.stderr)
            refused=subprocess.run(command+['--acknowledge-reused-test'],capture_output=True,text=True)
            self.assertNotEqual(refused.returncode,0)
            self.assertEqual((out/'sentinel.txt').read_text(),'preserve')
            self.assertFalse((out/'benchmark.json').exists())


if __name__=='__main__':
    unittest.main(verbosity=2)
