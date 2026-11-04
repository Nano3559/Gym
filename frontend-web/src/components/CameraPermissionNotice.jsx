import { CameraOff, Lock, RefreshCw, ShieldAlert } from 'lucide-react'

// Aviso cuando el navegador no deja usar la cámara. Distingue el permiso
// denegado (que el usuario puede conceder y reintentar) de otros fallos.

const INSTRUCTIONS = {
  NotAllowedError: 'Permite el acceso a la cámara desde el candado o el icono de permisos que aparece junto a la barra de direcciones.',
  PermissionDeniedError: 'Permite el acceso a la cámara en los ajustes del navegador para este sitio y vuelve a intentarlo.',
  SecurityError: 'La cámara solo funciona en conexiones seguras. Abre la app en HTTPS o en localhost.',
  unsupported: 'Este navegador no permite abrir la cámara. Usa Chrome, Edge o Safari actualizado.',
  NotFoundError: 'No hay ninguna cámara conectada. Conecta una y vuelve a intentarlo.',
  NotReadableError: 'Otra aplicación está usando la cámara. Ciérrala e inténtalo de nuevo.',
}

export default function CameraPermissionNotice({ errorCode, error, onRetry, onDismiss }) {
  if (!error) return null

  const isPermission = ['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].includes(errorCode)
  const Icon = isPermission ? Lock : ShieldAlert
  const instruction = INSTRUCTIONS[errorCode]
  const canRetry = errorCode !== 'unsupported' && errorCode !== 'NotFoundError'

  return (
    <div
      role="alert"
      className="space-y-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-red-200">
            {isPermission ? 'Falta permiso para usar la cámara' : 'No se pudo abrir la cámara'}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-red-200/90">{error}</p>
          {instruction && <p className="mt-2 text-sm leading-relaxed text-muted">{instruction}</p>}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {canRetry && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-red-400/50 px-4 py-2 text-sm font-bold uppercase tracking-wide text-red-200 transition hover:bg-red-500/20"
          >
            <RefreshCw className="h-4 w-4" />
            Reintentar
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-line px-4 py-2 text-sm font-semibold text-muted transition hover:text-white"
          >
            <CameraOff className="h-4 w-4" />
            Seguir sin cámara
          </button>
        )}
      </div>
    </div>
  )
}
