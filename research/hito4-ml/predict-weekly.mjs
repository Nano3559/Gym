// Research-only format. Deliberately refuses production use and DIETFITS artifacts.
const features=['weight_anchor_kg','trend_kg_week','intake_mean_kcal','expenditure_mean_kcal','weight_sd_kg']
const units=['kg','kg/week','kcal/day','kcal/day','kg']
export function predictWeekly(artifact, values){
  if(artifact?.format!=='weekly-ridge-v1'||artifact.horizon_days!==7||artifact.deployable!==false||JSON.stringify(artifact.features)!==JSON.stringify(features)||JSON.stringify(artifact.units)!==JSON.stringify(units))throw new Error('Incompatible research model')
  for(const key of ['imputation','means','scales','coefficients','minimum','maximum'])if(!Array.isArray(artifact[key])||artifact[key].length!==5||artifact[key].some(v=>!Number.isFinite(v)))throw new Error('Invalid parameters')
  if(!Number.isFinite(artifact.intercept)||!Number.isFinite(artifact.radius_kg)||artifact.radius_kg<0||artifact.scales.some(v=>v<=0)||artifact.minimum.some((v,i)=>v>artifact.maximum[i])||!Array.isArray(values)||values.length!==5)throw new Error('Invalid input')
  const x=values.map((v,i)=>{if(v===null)v=artifact.imputation[i];if(!Number.isFinite(v)||v<artifact.minimum[i]||v>artifact.maximum[i])throw new Error('Outside evaluated range');return v})
  const delta=artifact.coefficients.reduce((sum,v,i)=>sum+v*(x[i]-artifact.means[i])/artifact.scales[i],artifact.intercept)
  const predicted=x[0]+delta
  if(!Number.isFinite(predicted)||predicted<20||predicted>500)throw new Error('Invalid prediction')
  return {predicted_kg:predicted,lower_kg:predicted-artifact.radius_kg,upper_kg:predicted+artifact.radius_kg,production:false}
}
