export function assessDailyActivity(answers){
  if(!['seated','mixed','physical'].includes(answers?.posture)||!['under30','30to90','over90'].includes(answers?.walking))throw new Error('Responde las dos preguntas de actividad cotidiana.')
  const factor=answers.posture==='physical'?'1.8':answers.posture==='mixed'||answers.walking!=='under30'?'1.6':'1.4'
  const activityLevel=factor==='1.8'?'high':factor==='1.4'?'sedentary':answers.posture==='seated'?'light':'moderate'
  return {version:'daily-self-report-v1',answers:{posture:answers.posture,walking:answers.walking},factor,activityLevel,
    label:factor==='1.8'?'Trabajo cotidiano activo':factor==='1.6'?'Movimiento cotidiano moderado':'Poco movimiento cotidiano'}
}
