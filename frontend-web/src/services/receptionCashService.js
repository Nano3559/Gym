export const CASH_OPERATIONS_KEY = 'ironforge-reception-cash'
export const POS_SALES_KEY = 'ironforge-pos-sales'
export const CASH_SHIFTS_KEY = 'ironforge-cash-shifts'

function readList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function writeList(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function getCashOperations() {
  return readList(CASH_OPERATIONS_KEY)
}

export function appendCashOperation(operation) {
  const entries = getCashOperations()
  const next = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ...operation }
  writeList(CASH_OPERATIONS_KEY, [next, ...entries])
  return next
}

export function getPosSales() {
  return readList(POS_SALES_KEY)
}

export function appendPosSale(sale) {
  const sales = getPosSales()
  writeList(POS_SALES_KEY, [sale, ...sales])
  appendCashOperation({
    type: 'sale',
    description: sale.items.map((item) => `${item.quantity} × ${item.name}`).join(', '),
    amount: sale.total,
    method: sale.method,
    date: sale.date,
    time: sale.time,
    shiftId: sale.shiftId,
    receiptId: sale.receiptId,
  })
}

export function getCashShifts() {
  return readList(CASH_SHIFTS_KEY)
}

export function getActiveCashShift() {
  return getCashShifts().find((shift) => !shift.closedAt) || null
}

export function openCashShift(openingCash, operator = 'Recepción') {
  const shifts = getCashShifts()
  if (shifts.some((shift) => !shift.closedAt)) return null
  const shift = {
    id: `turno-${Date.now()}`,
    operator,
    openedAt: new Date().toISOString(),
    openingCash: Number(openingCash),
  }
  writeList(CASH_SHIFTS_KEY, [shift, ...shifts])
  return shift
}

export function closeCashShift(shiftId, closingCash, expectedCash) {
  const shifts = getCashShifts()
  const target = shifts.find((shift) => shift.id === shiftId && !shift.closedAt)
  if (!target) return null
  const closed = {
    ...target,
    closedAt: new Date().toISOString(),
    closingCash: Number(closingCash),
    expectedCash: Number(expectedCash),
    difference: Number(closingCash) - Number(expectedCash),
  }
  writeList(CASH_SHIFTS_KEY, shifts.map((shift) => shift.id === shiftId ? closed : shift))
  return closed
}
