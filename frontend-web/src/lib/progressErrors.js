export function progressErrorMessage(error){
  const message=String(error?.message||''),code=String(error?.code||'')
  if(['42P01','42703','PGRST202','PGRST204','PGRST205'].includes(code))return 'La base de datos todavía no expone las tablas o funciones necesarias. Ejecuta las migraciones pendientes con db push (dry-run solo las muestra) y pulsa Reintentar después. Si ya las aplicaste, recarga la página.'
  if(/inicia sesión|jwt|auth session|invalid.*token/i.test(message)||code==='PGRST301')return 'Inicia sesión con una cuenta real registrada. Las antiguas cuentas de demostración no crean una sesión de Supabase y no pueden guardar progreso.'
  if(code==='42501'){
    const target=message.match(/permission denied for (?:table|schema|function) ([a-zA-Z_][a-zA-Z_0-9]*)/i)?.[1]
    return `Supabase rechazó el acceso${target?` a «${target}»`:''} (42501). Aplica las migraciones pendientes de permisos y vuelve a intentarlo. Las políticas por usuario deben permanecer activas.`
  }
  if(/fetch|network|timeout|connection terminated/i.test(message))return 'No se pudo conectar con Supabase. Comprueba que el proyecto esté activo y vuelve a intentarlo.'
  return message||'No se pudo completar la operación. Vuelve a intentarlo.'
}
