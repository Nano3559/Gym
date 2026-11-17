// Paginación explícita para las consultas de Finanzas.
//
// Supabase devuelve como máximo un número limitado de filas por consulta
// (1000 por defecto). Se recorre con `.range()` hasta agotar las filas y se
// trata cualquier error de página como fallo total: nunca se devuelve un
// resultado parcial como si fuera definitivo.

export const FINANCE_PAGE_SIZE = 1000

export async function fetchAllRows(buildQuery, pageSize = FINANCE_PAGE_SIZE) {
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    throw new Error('El tamaño de página debe ser un entero positivo.')
  }

  const rows = []
  let offset = 0

  for (;;) {
    const { data, error } = await buildQuery().range(offset, offset + pageSize - 1)
    if (error) throw error
    const chunk = Array.isArray(data) ? data : []
    rows.push(...chunk)
    if (chunk.length < pageSize) return rows
    offset += pageSize
  }
}
