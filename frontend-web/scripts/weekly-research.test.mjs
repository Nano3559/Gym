import assert from 'node:assert/strict'
import { test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { create,act } from 'react-test-renderer'
import { readFile } from 'node:fs/promises'
import WeeklyResearchPanel from '../src/components/WeeklyResearchPanel.jsx'
import * as service from '../src/services/weeklyResearchService.js'
import { predictWeekly } from '../../research/hito4-ml/predict-weekly.mjs'
let logged=true, failure=null, calls=[],consents=[]
globalThis.__gymSupabaseDouble={auth:{getUser:async()=>({data:{user:logged?{id:'owner'}:null}})},from:table=>{assert.equal(table,'weekly_research_consents');return {select:()=>({eq:(key,id)=>{assert.equal(key,'user_id');assert.equal(id,'owner');return {order:()=>({order:async()=>({data:consents,error:failure})})}}})}},rpc:async(name,args)=>{calls.push({name,args});if(name==='set_weekly_research_consent'&&!failure)consents=[{id:String(calls.length),purpose:args.p_purpose,granted:args.p_granted,policy_version:args.p_policy},...consents];return {data:name==='export_weekly_research'?{format:'weekly-research-export-v1',purpose:args.p_purpose,entries:[],weights:[]}:'receipt',error:failure}}}
test('Consent is explicit, purpose limited and RPCs never accept another owner',async()=>{
  assert.deepEqual(await service.getWeeklyConsents(),[])
  await service.setWeeklyConsent('training',true)
  assert.deepEqual(calls.at(-1),{name:'set_weekly_research_consent',args:{p_purpose:'training',p_granted:true,p_policy:'weekly-consent-v1'}})
  await service.setWeeklyConsent('evaluation',false)
  assert.equal(calls.at(-1).args.p_granted,false)
  await service.captureWeeklyProjection('projection')
  assert.deepEqual(calls.at(-1).args,{p_projection:'projection'})
  assert.equal((await service.exportWeeklyResearch('evaluation')).purpose,'evaluation')
  const count=calls.length
  await assert.rejects(service.setWeeklyConsent('marketing',true),/Finalidad/)
  await assert.rejects(service.setWeeklyConsent('training','yes'),/Decisión/)
  await assert.rejects(service.captureWeeklyProjection(null),/Emite/)
  assert.equal(calls.length,count)
  logged=false
  await assert.rejects(service.getWeeklyConsents(),/Inicia sesión/)
  await assert.rejects(service.exportWeeklyResearch('training'),/Inicia sesión/)
  assert.equal(calls.length,count)
  logged=true;failure=new Error('permission denied')
  await assert.rejects(service.setWeeklyConsent('training',true),/permission/)
  failure=null
})
test('Optional panel starts without grants and does not require database during render',()=>{
  const count=calls.length
  const html=renderToStaticMarkup(React.createElement(WeeklyResearchPanel,{projectionId:null}))
  assert.match(html,/No hay un modelo semanal aprobado/)
  assert.match(html,/Consultar mis autorizaciones/)
  assert.doesNotMatch(html,/Autorizar esta finalidad/)
  assert.match(html,/disabled=""/)
  assert.equal(calls.length,count)
})
test('Research inference rejects three-month artifacts, wrong units, nonfinite and out-of-range data',()=>{
  const model={format:'weekly-ridge-v1',horizon_days:7,deployable:false,features:['weight_anchor_kg','trend_kg_week','intake_mean_kcal','expenditure_mean_kcal','weight_sd_kg'],units:['kg','kg/week','kcal/day','kcal/day','kg'],imputation:[80,0,2000,2400,.2],means:[80,0,2000,2400,.2],scales:[1,1,1,1,1],coefficients:[0,1,0,0,0],intercept:0,radius_kg:1,minimum:[60,-1,1000,1000,0],maximum:[120,1,4000,5000,2]}
  assert.equal(predictWeekly(model,[80,.2,2000,2400,.2]).predicted_kg,80.2)
  assert.equal(predictWeekly(model,[null,null,null,null,null]).production,false)
  for(const patch of [{format:'ridge-research-v2'},{horizon_days:90},{deployable:true},{units:['lb']},{scales:[0,1,1,1,1]},{intercept:NaN}])assert.throws(()=>predictWeekly({...model,...patch},[80,0,2000,2400,.2]))
  for(const values of [[500,0,2000,2400,.2],[80,NaN,2000,2400,.2],[80,undefined,2000,2400,.2],[]])assert.throws(()=>predictWeekly(model,values))
})
test('User grants, withdraws, captures and handles denied research without hiding the baseline',async()=>{
  consents=[]
  globalThis.IS_REACT_ACT_ENVIRONMENT=true
  let renderer
  await act(async()=>{renderer=create(React.createElement(WeeklyResearchPanel,{projectionId:'issue'}))})
  const click=async label=>act(async()=>{await renderer.root.findAllByType('button').find(b=>b.children.join('')===label).props.onClick()})
  await click('Consultar mis autorizaciones')
  const grant=renderer.root.findAllByType('button').filter(b=>b.children.join('')==='Autorizar esta finalidad')[0]
  await act(async()=>{await grant.props.onClick()})
  assert.equal(calls.at(-1).args.p_purpose,'training')
  await click('Retirar autorización')
  assert.equal(calls.at(-1).args.p_granted,false)
  await click('Registrar copia de la emisión en el piloto')
  assert.equal(calls.at(-1).name,'capture_weekly_research')
  failure={code:'PGRST202'}
  await click('Consultar mis autorizaciones')
  assert.match(renderer.root.findByProps({role:'alert'}).children.join(''),/migración 24/)
  assert.match(JSON.stringify(renderer.toJSON()),/Tu proyección habitual continúa/)
  failure=null
  await act(async()=>renderer.unmount())
})
test('Migration guards owner access and withdrawal; static review is not a database integration test',async()=>{
  const sql=await readFile(new URL('../../supabase/migrations/20261106000024_weekly_research_consent.sql',import.meta.url),'utf8')
  assert.equal((sql.match(/enable row level security/g)||[]).length,4)
  assert.equal((sql.match(/owner_id uuid:=auth.uid\(\)/g)||[]).length,3)
  assert.match(sql,/if not p_granted then delete from public.weekly_research_entries where user_id=owner_id/)
  assert.match(sql,/row_data\.created_at/)
  assert.doesNotMatch(sql,/grant (insert|update|delete|all) on public\.weekly_research/i)
})
