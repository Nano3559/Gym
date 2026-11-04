export default function ProgressStartCard({onProfile,onDiary,authenticated=false}){
  return <section className="mt-6 space-y-4 rounded-2xl border border-accent/40 bg-card p-5" aria-label="Cómo empezar el seguimiento del peso">
    <h3 className="text-2xl font-bold">Empieza tu seguimiento de peso</h3>
    <ol className="grid gap-4 sm:grid-cols-3"><li><strong>1. Completa tus datos</strong><p className="text-sm text-muted">Fecha de nacimiento, estatura y actividad diaria habitual.</p></li><li><strong>2. Guarda tu meta y peso inicial</strong><p className="text-sm text-muted">Hazlo en Mi progreso. Los pesajes posteriores formarán tu historial.</p></li><li><strong>3. Registra tu día</strong><p className="text-sm text-muted">Añade comidas y actividad en Mi diario, revisa el gasto y confirma los registros.</p></li></ol>
    <div className="flex flex-wrap gap-3"><button className="min-h-12 rounded-xl bg-accent px-5 font-bold" onClick={onProfile}>{authenticated?'1. Completar mis datos en Mi progreso':'Iniciar sesión y completar mis datos'}</button><button className="min-h-12 rounded-xl border border-line px-5 font-semibold" onClick={onDiary}>Abrir Mi diario</button></div>
    <p className="text-sm text-muted">Puedes registrar tus datos desde el primer día. La tendencia y la proyección se habilitan al reunir suficiente historial; no se inventan resultados si faltan registros.</p>
  </section>
}
