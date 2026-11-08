import copy
import hashlib
import json
import subprocess
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path
import numpy as np
from threadpoolctl import threadpool_limits
import weekly_protocol as w
WORK=Path(__file__).parent/'.test-work'
WORK.mkdir(exist_ok=True)


def packet():
    weights = [dict(id=str(i), weight_kg=80-i*.02, measured_at=f'{date(2026,10,5)+timedelta(days=i)}T12:00:00Z') for i in range(28)]
    snapshot = dict(version='observed-weekly-v2', ready=True, asOf='2026-11-01', timezone='UTC', slope=-.02,
        inputs=dict(calculatedAt='2026-11-02T11:59:00Z',weights=weights,balance=[dict(day=str(date(2026,10,5)+timedelta(days=i)),eligible=True,intake=2000,expenditure=2400) for i in range(28)]))
    text=json.dumps(snapshot)
    entry=dict(id='entry',issued_at='2026-11-02T12:00:00Z',scope=dict(age_at_issue=30,formula_sex='male',activity_level='light',estimates_paused=False),consent_id='grant',frozen_inputs=snapshot,canonical_inputs_text=text,inputs_sha256=hashlib.sha256(text.encode()).hexdigest())
    return dict(format='weekly-research-export-v1',policy_version=w.POLICY,purpose='training',exported_at='2026-11-12T12:00:00Z',participant_id='person',consents=[dict(id='grant',purpose='training',granted=True,policy_version=w.POLICY,at='2026-11-01T12:00:00Z')],entries=[entry],weights=[dict(id=f'out-{i}',weight_kg=79.3+i*.1,measured_at=f'2026-11-{i+8:02}T12:00:00Z',created_at=f'2026-11-{i+8:02}T12:01:00Z',updated_at=f'2026-11-{i+8:02}T12:01:00Z') for i in range(3)])


def resign(p):
    e=p['entries'][0];e['canonical_inputs_text']=json.dumps(e['frozen_inputs']);e['inputs_sha256']=hashlib.sha256(e['canonical_inputs_text'].encode()).hexdigest()


class WeeklyTests(unittest.TestCase):
    def test_real_calendar_horizon_and_daily_medians(self):
        p=packet();row=w.example(p,p['entries'][0])
        self.assertEqual(row['outcome_days'],['2026-11-08','2026-11-09','2026-11-10'])
        self.assertAlmostEqual(row['actual_kg'],79.4)
        self.assertEqual(len(row['features']),5)
        self.assertAlmostEqual(row['trend_kg'],row['features'][0]-.16)

    def test_consent_withdrawal_and_regrant(self):
        for regrant in [False,True]:
            p=packet();p['consents'].append(dict(id='withdraw',purpose='training',granted=False,at='2026-11-03T00:00Z',policy_version=w.POLICY))
            if regrant:p['consents'].append(dict(id='new',purpose='training',granted=True,at='2026-11-04T00:00Z',policy_version=w.POLICY))
            with self.assertRaisesRegex(ValueError,'Consent'):w.example(p,p['entries'][0])

    def test_simultaneous_conflict_and_future_consent(self):
        p=packet();p['consents'][0]['at']='2026-11-03T00:00Z'
        with self.assertRaises(ValueError):w.example(p,p['entries'][0])
        p=packet();p['consents'].append(dict(p['consents'][0],id='conflict',granted=False))
        with self.assertRaises(ValueError):w.example(p,p['entries'][0])

    def test_scope_and_wrong_contract(self):
        for field,value in [('age_at_issue',18),('age_at_issue',60),('estimates_paused',True),('formula_sex',None),('activity_level','unknown')]:
            p=packet();p['entries'][0]['scope'][field]=value
            with self.assertRaises(ValueError):w.example(p,p['entries'][0])
        p=packet();p['entries'][0]['frozen_inputs']['version']='dietfits-comparison-v2';resign(p)
        with self.assertRaises(ValueError):w.example(p,p['entries'][0])

    def test_hash_tampering(self):
        p=packet();p['entries'][0]['frozen_inputs']['slope']=1
        with self.assertRaisesRegex(ValueError,'integrity'):w.example(p,p['entries'][0])

    def test_missing_energy_duplicate_days_and_future_features(self):
        changes=[lambda s:s['inputs']['balance'][0].update(intake=None),lambda s:s['inputs']['balance'][0].update(eligible=False),lambda s:s['inputs']['balance'][0].update(day=s['inputs']['balance'][1]['day']),lambda s:s['inputs']['weights'][0].update(measured_at='2026-11-12T00:00Z')]
        for change in changes:
            p=packet();change(p['entries'][0]['frozen_inputs']);resign(p)
            with self.assertRaises(ValueError):w.example(p,p['entries'][0])

    def test_sparse_and_stale_weights(self):
        p=packet();p['entries'][0]['frozen_inputs']['inputs']['weights']=p['entries'][0]['frozen_inputs']['inputs']['weights'][:7];resign(p)
        with self.assertRaisesRegex(ValueError,'distinct'):w.example(p,p['entries'][0])

    def test_incomplete_and_future_outcome(self):
        p=packet();p['exported_at']='2026-11-10T13:00Z'
        with self.assertRaisesRegex(ValueError,'matured'):w.example(p,p['entries'][0])
        p=packet();p['weights']=p['weights'][:1]
        with self.assertRaisesRegex(ValueError,'distinct'):w.example(p,p['entries'][0])
        p=packet();p['weights'][0]['updated_at']='2026-11-13T00:00Z'
        with self.assertRaises(ValueError):w.example(p,p['entries'][0])

    def test_build_exclusions_purpose_and_stale_exports(self):
        p=packet();p['weights']=[]
        rows,excluded=w.build([p],'training');self.assertEqual(rows,[]);self.assertEqual(len(excluded),1)
        with self.assertRaises(ValueError):w.build([packet()],'evaluation')
        with self.assertRaises(ValueError):w.build([packet(),packet()],'training')

    def test_person_temporal_split_and_latest_only(self):
        rows=[]
        for i in range(1000):
            person=str(i);test=w.partition(person)=='test'
            rows.append(dict(person=person,issued_at='2026-11-02T00:00Z' if test else '2026-09-02T00:00Z',available_at='2026-11-11T00:00Z' if test else '2026-09-11T00:00Z'))
        groups=w.split_rows(rows+rows,'2026-10-01T00:00Z','2026-11-01T00:00Z')
        self.assertEqual(sum(map(len,groups.values())),1000)
        self.assertTrue(all({r['person'] for r in groups[a]}.isdisjoint({r['person'] for r in groups[b]}) for a in groups for b in groups if a!=b))
        with self.assertRaises(ValueError):w.split_rows(rows,'2026-11-01T00:00Z','2026-10-01T00:00Z')

    def test_missing_sample_blocks_and_run_is_immutable(self):
        manifest=dict(version=w.VERSION,fit_cutoff='2026-10-01T00:00Z',test_start='2026-11-01T00:00Z',data_sha256=w.digest([]),code_sha256=hashlib.sha256(Path(w.__file__).read_bytes()).hexdigest())
        with tempfile.TemporaryDirectory(dir=WORK) as temp:
            output=Path(temp)/'run';result=w.train([],manifest,output)
            self.assertFalse(result['deployable']);self.assertEqual(result['status'],'insufficient_real_weekly_data')
            with self.assertRaises(FileExistsError):w.train([],manifest,output)
        manifest['data_sha256']='bad'
        with self.assertRaises(ValueError):w.train([],manifest,'unused')

    def test_conformal_and_adoption_boundaries(self):
        with self.assertRaises(ValueError):w.conformal([.1])
        self.assertEqual(w.conformal(list(range(50))),45)
        m=dict(mae_kg=.5,reference_mae_kg=1,bias_kg=.1,coverage=.9,interval_width_kg=2,paired_improvement_ci_low_kg=.1)
        self.assertTrue(w.adoption(m))
        for key,value in [('mae_kg',.9),('bias_kg',.51),('coverage',.84),('interval_width_kg',4.01),('paired_improvement_ci_low_kg',0)]:self.assertFalse(w.adoption(dict(m,**{key:value})))
        self.assertFalse(w.adoption({}))

    def test_complete_synthetic_pipeline_is_not_a_real_pilot(self):
        rng=np.random.default_rng(407);rows=[]
        for i in range(1100):
            person=str(i);test=w.partition(person)=='test'
            features=rng.uniform([70,-.4,1800,2200,.1],[100,.4,2400,3000,.8]).tolist()
            delta=features[1]*.6+float(rng.normal(0,.1))
            rows.append(dict(person=person,issued_at='2026-11-02T00:00Z' if test else '2026-09-02T00:00Z',available_at='2026-11-11T00:00Z' if test else '2026-09-11T00:00Z',features=features,delta_kg=delta,actual_kg=features[0]+delta,persistence_kg=features[0],trend_kg=features[0]+features[1],scope=dict(age_at_issue=30,formula_sex='male',activity_level='light')))
        manifest=dict(version=w.VERSION,fit_cutoff='2026-10-01T00:00Z',test_start='2026-11-01T00:00Z',data_sha256=w.digest(rows),code_sha256=hashlib.sha256(Path(w.__file__).read_bytes()).hexdigest())
        with tempfile.TemporaryDirectory(dir=WORK) as temp:
            output=Path(temp)/'run';result=w.train(rows,manifest,output)
            self.assertEqual(result['status'],'research_review_only')
            self.assertEqual(len(result['candidates']),7)
            self.assertTrue((output/'test-opened.lock').exists())
            self.assertFalse(result['deployable']);self.assertFalse(result['activates_app'])
            self.assertIn('prospective_shadow_pilot',result['pending'])

    def test_seven_candidates_train_only_transforms_and_js_parity(self):
        rng=np.random.default_rng(407)
        def rows(n):
            x=rng.uniform([65,-.5,1700,2200,.1],[100,.5,2300,3000,.8],(n,5))
            return [dict(features=list(v),delta_kg=float(v[1]*.7)) for v in x]
        groups=dict(train=rows(60),validation=rows(20))
        with threadpool_limits(limits=1):selected,candidates=w.fit_candidates(groups)
        self.assertEqual(len(candidates),7)
        self.assertTrue(any(c['name'].startswith('boosting') for c in candidates))
        from sklearn.pipeline import Pipeline
        from sklearn.impute import SimpleImputer
        from sklearn.preprocessing import StandardScaler
        from sklearn.linear_model import Ridge
        x=np.asarray([r['features'] for r in groups['train']]);y=np.asarray([r['delta_kg'] for r in groups['train']])
        model=Pipeline([('impute',SimpleImputer(strategy='median')),('scale',StandardScaler()),('model',Ridge(alpha=1))]).fit(x,y)
        artifact=w.ridge_export(model,groups['train'],.4)
        self.assertTrue(np.allclose(model['scale'].mean_,x.mean(axis=0)))
        inputs=x[:12].tolist()+[[None]*5]
        script="import {predictWeekly} from './predict-weekly.mjs'; let s='';for await(const c of process.stdin)s+=c;const p=JSON.parse(s);console.log(JSON.stringify(p.inputs.map(x=>predictWeekly(p.artifact,x).predicted_kg)))"
        result=subprocess.run(['node','--input-type=module','-e',script],input=json.dumps(dict(inputs=inputs,artifact=artifact)),capture_output=True,text=True,cwd=Path(w.__file__).parent,check=True)
        expected=model.predict([[np.nan if v is None else v for v in row] for row in inputs])+[artifact['imputation'][0] if row[0] is None else row[0] for row in inputs]
        self.assertLess(np.max(abs(expected-json.loads(result.stdout))),1e-10)

    def test_monitor_degradation_and_recovery(self):
        rows=[dict(person=str(i),version='weekly-v1',horizon_days=7,issued_at='2026-10-20T00:00Z',target_at='2026-10-28T00:00Z',observed_at='2026-10-29T00:00Z',predicted_kg=80,actual_kg=80.1,reference_kg=81,lower_kg=79,upper_kg=81) for i in range(30)]
        self.assertEqual(w.monitor(rows[:29],'weekly-v1','2026-11-06T00:00Z')['action'],'fallback')
        self.assertEqual(w.monitor(rows+rows,'weekly-v1','2026-11-06T00:00Z')['people'],30)
        self.assertEqual(w.monitor(rows,'weekly-v1','2026-11-06T00:00Z',True)['action'],'approval_required')
        bad=copy.deepcopy(rows)
        for r in bad:r['actual_kg']=84
        self.assertEqual(w.monitor(bad,'weekly-v1','2026-11-06T00:00Z')['action'],'fallback')
        self.assertEqual(w.monitor(rows,'weekly-v1','2027-01-06T00:00Z')['action'],'fallback')

    def test_shadow_immutable_fresh_and_consent_required(self):
        args=dict(person='p',version=w.VERSION+'-model',frozen_inputs={'a':1},prediction=dict(predicted_kg=80,lower_kg=79,upper_kg=81),issued_at='2026-11-06T12:00Z',now='2026-11-06T12:01Z',evaluation_grant='grant')
        with tempfile.TemporaryDirectory(dir=WORK) as temp:
            path=w.register_shadow(temp,**args);self.assertFalse(json.loads(path.read_text())['production'])
            with self.assertRaises(FileExistsError):w.register_shadow(temp,**args)
            with self.assertRaises(ValueError):w.register_shadow(temp,**dict(args,evaluation_grant=None))
            with self.assertRaises(ValueError):w.register_shadow(temp,**dict(args,now='2026-11-07T12:00Z'))

    def test_monthly_review_not_per_meal(self):
        self.assertTrue(w.monthly_review('2026-10-01T00:00Z','2026-11-06T00:00Z',30,True))
        for now,n,authorized in [('2026-10-02T00:00Z',30,True),('2026-11-06T00:00Z',29,True),('2026-11-06T00:00Z',30,False)]:self.assertFalse(w.monthly_review('2026-10-01T00:00Z',now,n,authorized))

    def test_shadow_path_uses_no_outcomes_and_checks_model_time_scope_and_range(self):
        p=packet();p['purpose']='evaluation';p['consents'][0]['purpose']='evaluation';p['exported_at']='2026-11-02T12:01Z';p['weights']='must not be read'
        e=p['entries'][0];features=w.features_at_issue(p,e)['features']
        a=dict(format='weekly-ridge-v1',version=w.VERSION+'-test',features=w.FEATURES,units=w.UNITS,horizon_days=7,deployable=False,created_at='2026-11-01T00:00Z',manifest={'fit_cutoff':'2026-10-01T00:00Z'},evaluated_subgroups={'30:male:light':dict(people=30,bias_kg=0,coverage=.9)},means=features,scales=[1]*5,coefficients=[0]*5,minimum=[v-1 for v in features],maximum=[v+1 for v in features],radius_kg=1,intercept=0)
        with tempfile.TemporaryDirectory(dir=WORK) as temp:
            path=w.shadow_predict(temp,a,p,e,'2026-11-02T12:01Z')
            receipt=json.loads(path.read_text(encoding='utf-8'))
            self.assertAlmostEqual(receipt['prediction']['predicted_kg'],features[0]);self.assertFalse(receipt['production'])
            for patch in [dict(created_at='2026-11-03T00:00Z'),dict(evaluated_subgroups={}),dict(minimum=[v+1 for v in features]),dict(format='dietfits-v2'),dict(radius_kg=3)]:
                with self.assertRaises(ValueError):w.shadow_predict(temp,dict(a,**patch),p,e,'2026-11-02T12:01Z')


if __name__=='__main__':unittest.main()
