import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  Loader2,
  QrCode,
  Banknote,
  Landmark,
  CreditCard,
  RefreshCw,
  Clock3,
  Hash,
  X,
} from 'lucide-react'
import Modal from './ui/Modal'
import usePaymentMVI, { PAYMENT_STATUS } from '../hooks/usePaymentMVI'
import {
  generarTransactionId,
  generarPayloadQR,
  crearRegistroPagoPendiente,
  confirmarPagoExitoso,
} from '../services/paymentService'
import { registeredClientFromUser, saveRegisteredClient } from '../lib/registeredClients'

const METODOS = [
  { key: 'qr', label: 'QR', icon: QrCode },
  { key: 'efectivo', label: 'Efectivo', icon: Banknote },
  { key: 'transferencia', label: 'Transferencia', icon: Landmark },
  { key: 'tarjeta', label: 'Tarjeta', icon: CreditCard },
]

const EXPIRACION_SEGUNDOS = 5 * 60

// ---------------------------------------------------------------------------
// QR SVG estilizado: genera una matriz determinística (pseudo-QR) a partir del
// payload para no depender de la librería qrcode.react.
// ---------------------------------------------------------------------------
function PayloadQR({ value, size = 176 }) {
  const matrix = useMemo(() => {
    let seed = 0
    for (let i = 0; i < value.length; i += 1) seed = (seed * 31 + value.charCodeAt(i)) >>> 0
    const grid = 21
    const cells = []
    for (let r = 0; r < grid; r += 1) {
      for (let c = 0; c < grid; c += 1) {
        const corner = (r < 7 && c < 7) || (r < 7 && c >= grid - 7) || (r >= grid - 7 && c < 7)
        if (corner) {
          cells.push({ x: c, y: r, on: false, anchor: true })
          continue
        }
        seed = (seed * 1664525 + 1013904223) >>> 0
        cells.push({ x: c, y: r, on: (seed >>> 16) % 100 < 48, anchor: false })
      }
    }
    return cells
  }, [value])

  const cell = size / 21

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      role="img"
      aria-label="Código QR de pago"
      className="rounded-xl bg-white p-2"
    >
      {matrix.map((c) => (
        <rect
          key={`${c.x}-${c.y}`}
          x={c.x * cell}
          y={c.y * cell}
          width={cell}
          height={cell}
          fill={c.anchor ? 'transparent' : c.on ? '#0a0a0a' : 'transparent'}
        />
      ))}
      {[0, 14].map((ox) =>
        [0, 14].map((oy) => (
          <g key={`${ox}-${oy}`}>
            <rect x={ox * cell} y={oy * cell} width={cell * 7} height={cell * 7} fill="none" stroke="#0a0a0a" strokeWidth={cell * 0.4} />
            <rect x={(ox + 2) * cell} y={(oy + 2) * cell} width={cell * 3} height={cell * 3} fill="#0a0a0a" />
          </g>
        ))
      )}
    </svg>
  )
}

function Spinner() {
  return <Loader2 className="h-5 w-5 animate-spin" />
}

// ---------------------------------------------------------------------------
// Utilidades de formato y validación de tarjeta.
// ---------------------------------------------------------------------------
function formatCardNumber(value) {
  const digits = value.replace(/\D/g, '').slice(0, 16)
  return digits.replace(/(.{4})/g, '$1 ').trim()
}

function formatExpiry(value) {
  const digits = value.replace(/\D/g, '').slice(0, 4)
  if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return digits
}

function isValidCardNumber(value) {
  return value.replace(/\D/g, '').length === 16
}

function isValidExpiry(value) {
  return /^\d{2}\/\d{2}$/.test(value)
}

// ---------------------------------------------------------------------------
// Vista previa animada de la tarjeta.
// ---------------------------------------------------------------------------
function CardPreview({ number, name, expiry }) {
  const displayNumber = number || '•••• •••• •••• ••••'
  return (
    <div className="relative aspect-[1.586/1] w-full max-w-sm overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-700 via-zinc-900 to-black p-5 text-white shadow-xl ring-1 ring-white/10 transition-transform duration-300 hover:scale-[1.02]">
      <div className="absolute -right-8 -top-10 h-40 w-40 rounded-full bg-accent/30 blur-2xl" />
      <div className="absolute -bottom-12 -left-6 h-40 w-40 rounded-full bg-zinc-600/30 blur-2xl" />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-center justify-between">
          <CreditCard className="h-7 w-7 text-accent" />
          <span className="font-display text-xs font-semibold uppercase tracking-widest text-zinc-300">
            Gym
          </span>
        </div>
        <div>
          <p className="font-mono text-xl tracking-wider">{displayNumber}</p>
          <div className="mt-3 flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-zinc-400">Titular</p>
              <p className="truncate text-sm font-semibold uppercase">{name || 'TU NOMBRE'}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[10px] uppercase tracking-wide text-zinc-400">Vence</p>
              <p className="font-mono text-sm">{expiry || 'MM/AA'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Input etiquetado reutilizable para el formulario de tarjeta.
// ---------------------------------------------------------------------------
function CardField({ label, ...props }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      <input
        {...props}
        className="w-full rounded-xl border border-line bg-card-2 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-accent"
      />
    </label>
  )
}

export default function PaymentModal({ isOpen, onClose, plan, user, onSuccess }) {
  const mvi = usePaymentMVI()
  const [metodo, setMetodo] = useState('qr')
  const [segundosRestantes, setSegundosRestantes] = useState(EXPIRACION_SEGUNDOS)
  const [cardNumero, setCardNumero] = useState('')
  const [cardNombre, setCardNombre] = useState('')
  const [cardExpiracion, setCardExpiracion] = useState('')
  const [cardCvc, setCardCvc] = useState('')

  const status = mvi.status
  const processing = status === PAYMENT_STATUS.PROCESSING

  // Inicia el flujo cuando se abre el modal con un plan seleccionado.
  useEffect(() => {
    if (isOpen && plan && status === PAYMENT_STATUS.IDLE) {
      mvi.initPayment(user, plan)
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, plan])

  // Genera el QR y el registro pendiente al entrar a GENERATING_QR.
  useEffect(() => {
    if (status !== PAYMENT_STATUS.GENERATING_QR) return undefined
    let cancelado = false

    const ejecutar = async () => {
      const transactionId = generarTransactionId()
      const qrPayload = generarPayloadQR(user, plan, transactionId)
      const { ok, message } = await crearRegistroPagoPendiente({
        userId: user?.id,
        planId: plan?.db_id || plan?.id,
        monto: plan?.price,
        metodoPago: metodo,
        transactionId,
        qrPayload,
      })
      if (cancelado) return
      if (!ok) {
        mvi.setError(message)
        return
      }
      mvi.qrGenerated(transactionId, qrPayload)
    }

    ejecutar()
    return () => {
      cancelado = true
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  // Cuenta regresiva de expiración mientras se espera el pago.
  useEffect(() => {
    if (status !== PAYMENT_STATUS.AWAITING_PAYMENT) return undefined
    setSegundosRestantes(EXPIRACION_SEGUNDOS)
    const timer = setInterval(() => {
      setSegundosRestantes((s) => {
        if (s <= 1) {
          clearInterval(timer)
          mvi.setError('El tiempo para completar el pago ha expirado. Intenta de nuevo.')
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(timer)
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const mm = Math.floor(segundosRestantes / 60)
  const ss = String(segundosRestantes % 60).padStart(2, '0')

  // Simula el pago: entra a PROCESSING y confirma vía RPC.
  const handleSimular = useCallback(async () => {
    if (status !== PAYMENT_STATUS.AWAITING_PAYMENT) return
    mvi.simulatePaymentSuccess()
    const { ok, message, membership } = await confirmarPagoExitoso({
      transactionId: mvi.transactionId,
      userId: user?.id,
      planId: plan?.db_id || plan?.id,
      monto: plan?.price,
      metodoPago: metodo,
    })
    if (ok) {
      mvi.paymentCompleted(membership)
      saveRegisteredClient(registeredClientFromUser(user, plan))
    } else {
      mvi.setError(message)
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [status, metodo, user, plan])

  const handleRetry = () => {
    mvi.reset()
    mvi.initPayment(user, plan)
  }

  const handleClose = () => {
    if (processing) return
    onClose()
    mvi.reset()
  }

  const handleFinish = () => {
    mvi.reset()
    onSuccess?.(mvi.membership)
    onClose()
  }

  const monto = Number(plan?.price ?? 0)

  const tarjetaValida = useMemo(
    () =>
      isValidCardNumber(cardNumero) &&
      cardNombre.trim().length > 0 &&
      isValidExpiry(cardExpiracion) &&
      cardCvc.replace(/\D/g, '').length >= 3,
    [cardNumero, cardNombre, cardExpiracion, cardCvc]
  )

  return (
    <Modal open={isOpen} onClose={handleClose} title="Pagar membresía">
      {status === PAYMENT_STATUS.GENERATING_QR && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Spinner />
          <p className="mt-4 text-sm text-muted">Preparando tu pago…</p>
        </div>
      )}

      {status === PAYMENT_STATUS.AWAITING_PAYMENT && (
        <div className="space-y-5">
          {/* Método de pago */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Método de pago
            </p>
            <div className="grid grid-cols-4 gap-2">
              {METODOS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMetodo(key)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-semibold transition ${
                    metodo === key
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-line text-muted hover:border-accent/40 hover:text-white'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Resumen del cobro */}
          <div className="rounded-xl border border-line bg-card-2 px-5 py-4">
            <div className="flex items-center justify-between">
              <p className="font-display text-lg font-semibold uppercase text-white">{plan?.name}</p>
              <p className="font-display text-2xl font-bold text-accent">Bs. {monto}</p>
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
              <Hash className="h-3.5 w-3.5" />
              Transacción: <span className="font-mono text-white">{mvi.transactionId}</span>
            </p>
          </div>

          {metodo === 'qr' && (
            <>
              <div className="flex flex-col items-center gap-3 rounded-xl border border-line bg-white/5 py-6">
                {mvi.qrPayload && <PayloadQR value={mvi.qrPayload} />}
                <p className="flex items-center gap-1.5 text-xs text-muted">
                  <Clock3 className="h-4 w-4 text-accent" />
                  Expira en{' '}
                  <span className="font-mono font-semibold text-white">
                    {mm}:{ss}
                  </span>
                </p>
              </div>
              <p className="text-center text-xs text-muted">
                Escanea el código con tu billetera para completar el pago.
              </p>
            </>
          )}

          {metodo !== 'qr' && metodo !== 'tarjeta' && (
            <div className="rounded-xl border border-line bg-white/5 px-5 py-4 text-sm text-muted">
              {metodo === 'efectivo' &&
                'Realiza el pago en caja del gimnasio y confirma la transacción a continuación.'}
              {metodo === 'transferencia' &&
                'Transfiere a la cuenta del gimnasio (Agencia Central) y usa tu ID de transacción como referencia.'}
            </div>
          )}

          {metodo === 'tarjeta' && (
            <div className="space-y-5">
              <div className="flex flex-col items-center">
                <CardPreview
                  number={cardNumero}
                  name={cardNombre}
                  expiry={cardExpiracion}
                />
              </div>

              <div className="space-y-3">
                <CardField
                  label="Número de tarjeta"
                  type="text"
                  inputMode="numeric"
                  placeholder="1234 5678 9012 3456"
                  autoComplete="cc-number"
                  value={cardNumero}
                  onChange={(e) => setCardNumero(formatCardNumber(e.target.value))}
                />
                <CardField
                  label="Nombre en la tarjeta"
                  type="text"
                  placeholder="NOMBRE APELLIDO"
                  autoComplete="cc-name"
                  value={cardNombre}
                  onChange={(e) => setCardNombre(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-3">
                  <CardField
                    label="Fecha de expiración"
                    type="text"
                    inputMode="numeric"
                    placeholder="MM/AA"
                    autoComplete="cc-exp"
                    value={cardExpiracion}
                    onChange={(e) => setCardExpiracion(formatExpiry(e.target.value))}
                  />
                  <CardField
                    label="CVC / CVV"
                    type="password"
                    inputMode="numeric"
                    placeholder="123"
                    autoComplete="cc-csc"
                    maxLength={4}
                    value={cardCvc}
                    onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
              </div>

              {!tarjetaValida && (
                <p className="text-center text-xs text-muted">
                  Completa los datos de tu tarjeta para habilitar el pago.
                </p>
              )}
            </div>
          )}

          {/* Botón de prueba universitaria */}
          <button
            type="button"
            onClick={handleSimular}
            disabled={metodo === 'tarjeta' && !tarjetaValida}
            className="btn-sheen flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            <CheckCircle2 className="h-4 w-4" />
            {metodo === 'tarjeta' ? `Pagar Bs. ${monto}` : 'Simular Pago Exitoso'}
          </button>
        </div>
      )}

      {processing && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Spinner />
          <p className="mt-4 font-display text-lg font-semibold uppercase text-white">
            Procesando pago…
          </p>
          <p className="mt-1 text-sm text-muted">
            No cierres esta ventana para evitar doble cobro.
          </p>
        </div>
      )}

      {status === PAYMENT_STATUS.SUCCESS && (
        <div className="flex flex-col items-center py-6 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-volt/15">
            <CheckCircle2 className="h-10 w-10 text-volt" />
          </span>
          <h3 className="mt-5 font-display text-2xl font-bold uppercase text-white">
            Pago confirmado
          </h3>
          <p className="mt-2 max-w-md text-muted">
            Tu membresía del{' '}
            <span className="font-semibold text-accent">{plan?.name}</span> se ha activado
            correctamente por Bs. {monto}.
          </p>
          <div className="mt-5 w-full rounded-xl border border-line bg-card-2 px-5 py-4 text-left text-sm">
            <div className="flex items-center justify-between py-1">
              <span className="text-muted">Plan activado</span>
              <span className="font-semibold text-white">{plan?.name}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-muted">Transacción</span>
              <span className="font-mono text-white">{mvi.transactionId}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-muted">Método</span>
              <span className="font-semibold capitalize text-white">
                {METODOS.find((m) => m.key === metodo)?.label}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleFinish}
            className="mt-6 rounded-xl bg-accent px-8 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-accent-hover"
          >
            Finalizar
          </button>
        </div>
      )}

      {status === PAYMENT_STATUS.ERROR && (
        <div className="flex flex-col items-center py-8 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15">
            <X className="h-8 w-8 text-red-400" />
          </span>
          <h3 className="mt-4 font-display text-xl font-bold uppercase text-white">
            Algo salió mal
          </h3>
          <p className="mt-2 max-w-sm text-sm text-muted">{mvi.error}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent px-8 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-accent-hover"
          >
            <RefreshCw className="h-4 w-4" />
            Reintentar
          </button>
        </div>
      )}

      {!processing && status === PAYMENT_STATUS.AWAITING_PAYMENT && (
        <button
          type="button"
          onClick={handleClose}
          className="mt-5 w-full rounded-xl border border-line px-6 py-3 text-sm font-semibold uppercase tracking-wide text-muted transition hover:text-white"
        >
          Cancelar
        </button>
      )}
    </Modal>
  )
}