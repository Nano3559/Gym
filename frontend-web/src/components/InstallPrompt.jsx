import { useState } from 'react'
import { Download, Share, X } from 'lucide-react'
import useInstallPrompt from '../hooks/useInstallPrompt'

// Aviso para instalar la app. En Chromium usa el diálogo del navegador; en iOS
// no hay API de instalación, así que se indica el camino manual.

export default function InstallPrompt({ onNotify }) {
  const { canInstall, needsIosHint, installed, promptInstall } = useInstallPrompt()
  const [dismissed, setDismissed] = useState(false)

  if (installed || dismissed || (!canInstall && !needsIosHint)) return null

  const handleInstall = async () => {
    const outcome = await promptInstall()
    if (outcome === 'dismissed') setDismissed(true)
    if (outcome === 'unsupported') setDismissed(true)
    if (outcome === 'accepted') onNotify?.('IronForge se está añadiendo a tu pantalla de inicio.')
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
      <div className="mx-auto flex max-w-3xl items-start gap-3 rounded-2xl border border-volt/30 bg-[#13150a] p-4 shadow-2xl animate-fade-up">
        {needsIosHint ? <Share className="mt-0.5 h-5 w-5 shrink-0 text-volt" /> : <Download className="mt-0.5 h-5 w-5 shrink-0 text-volt" />}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">Añade IronForge a tu pantalla de inicio</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            {needsIosHint
              ? 'Toca el botón de compartir de Safari y elige "Añadir a pantalla de inicio" para abrirla como app.'
              : 'Instálala para abrirla a pantalla completa y usarla sin conexión.'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleInstall}
          className="min-h-12 shrink-0 rounded-xl bg-accent px-4 py-2 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-accent-hover"
        >
          Instalar
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Cerrar aviso"
          className="min-h-12 w-9 shrink-0 rounded-lg text-muted transition hover:text-white"
        >
          <X className="mx-auto h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
