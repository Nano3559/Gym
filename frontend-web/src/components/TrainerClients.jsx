import { useState, useCallback, useEffect } from 'react'
import {
  Users,
  UserPlus,
  X,
  Check,
  Dumbbell,
  Search,
} from 'lucide-react'
import { supabase } from '../lib/supabase.js'

export default function TrainerClients({ onClose, onNotify }) {
  const [clients, setClients] = useState([])
  const [routines, setRoutines] = useState([])
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedClient, setSelectedClient] = useState(null)
  const [selectedRoutine, setSelectedRoutine] = useState(null)
  const [assigning, setAssigning] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: routinesData, error: routinesError } = await supabase
        .from('routines')
        .select('*, routine_exercises(*)')
        .order('created_at', { ascending: false })
      if (routinesError) throw routinesError
      setRoutines(routinesData ?? [])

      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('routine_assignments')
        .select('*')
        .eq('active', true)
      if (assignmentsError) throw assignmentsError
      setAssignments(assignmentsData ?? [])

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('nombre', { ascending: true })
      if (profilesError) throw profilesError
      setClients(profilesData ?? [])
    } catch {
      onNotify?.('Error al cargar datos', 'error')
    } finally {
      setLoading(false)
    }
  }, [onNotify])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filteredClients = clients.filter((client) => {
    const q = searchQuery.toLowerCase()
    return (
      client.nombre?.toLowerCase().includes(q) ||
      client.apellido?.toLowerCase().includes(q) ||
      client.email?.toLowerCase().includes(q)
    )
  })

  const getClientRoutines = useCallback(
    (clientId) => {
      return assignments
        .filter((a) => a.client_id === clientId)
        .map((a) => {
          const routine = routines.find((r) => r.id === a.routine_id)
          return { ...a, routine }
        })
        .filter((a) => a.routine)
    },
    [assignments, routines],
  )

  const handleAssign = useCallback(async () => {
    if (!selectedClient || !selectedRoutine) return
    setAssigning(true)
    try {
      const { error } = await supabase.from('routine_assignments').upsert({
        active: true,
        routine_id: selectedRoutine.id,
        client_id: selectedClient.id,
        assigned_by: (await supabase.auth.getUser()).data.user?.id,
      }, { onConflict: 'routine_id,client_id' })
      if (error) throw error
      onNotify?.('Rutina asignada correctamente', 'success')
      setShowAssignModal(false)
      setSelectedClient(null)
      setSelectedRoutine(null)
      loadData()
    } catch {
      onNotify?.('Error al asignar rutina', 'error')
    } finally {
      setAssigning(false)
    }
  }, [selectedClient, selectedRoutine, onNotify, loadData])

  const handleUnassign = useCallback(
    async (assignmentId) => {
      try {
        const { error } = await supabase
          .from('routine_assignments')
          .update({ active: false })
          .eq('id', assignmentId)
        if (error) throw error
        onNotify?.('Asignación eliminada', 'success')
        loadData()
      } catch {
        onNotify?.('Error al eliminar asignación', 'error')
      }
    },
    [onNotify, loadData],
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-line bg-card">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/20">
              <Users className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-white">Mis clientes</h2>
              <p className="text-sm text-muted">Asigna rutinas a tus clientes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-12 w-12 items-center justify-center rounded-xl border border-line text-muted transition hover:border-accent/50 hover:text-white"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-line p-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar cliente..."
              className="w-full rounded-xl border border-line bg-gray-800 py-3 pl-12 pr-4 text-white placeholder-gray-500 focus:border-accent focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-12 w-12 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="mx-auto mb-3 h-12 w-12 text-muted" />
              <p className="text-sm text-muted">No se encontraron clientes</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredClients.map((client) => {
                const clientRoutines = getClientRoutines(client.id)
                return (
                  <div
                    key={client.id}
                    className="rounded-2xl border border-line bg-gray-800 p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/20 text-lg font-bold text-accent">
                          {client.nombre?.[0] ?? 'C'}
                        </div>
                        <div>
                          <p className="font-semibold text-white">
                            {client.nombre} {client.apellido}
                          </p>
                          <p className="text-sm text-muted">{client.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedClient(client)
                          setShowAssignModal(true)
                        }}
                        className="flex h-12 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-white transition hover:bg-accent-hover"
                      >
                        <UserPlus className="h-4 w-4" />
                        Asignar
                      </button>
                    </div>

                    {clientRoutines.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <p className="text-xs uppercase tracking-widest text-muted">
                          Rutinas asignadas ({clientRoutines.length})
                        </p>
                        {clientRoutines.map((assignment) => (
                          <div
                            key={assignment.id}
                            className="flex items-center justify-between rounded-xl bg-black/20 px-4 py-3"
                          >
                            <div className="flex items-center gap-3">
                              <Dumbbell className="h-4 w-4 text-volt" />
                              <div>
                                <p className="text-sm font-semibold text-white">
                                  {assignment.routine.title}
                                </p>
                                <p className="text-xs text-muted">
                                  {assignment.routine.routine_exercises?.length ?? 0} ejercicios
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted">
                                {new Date(assignment.assigned_at).toLocaleDateString('es-ES')}
                              </span>
                              <button
                                onClick={() => handleUnassign(assignment.id)}
                                className="flex h-12 w-12 items-center justify-center rounded-lg border border-line text-muted transition hover:border-red-500/50 hover:text-red-400"
                                aria-label="Eliminar asignación"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {showAssignModal && selectedClient && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-2xl border border-line bg-card p-6">
            <h3 className="font-display text-lg font-bold text-white">
              Asignar rutina a {selectedClient.nombre}
            </h3>
            <p className="mt-1 text-sm text-muted">Selecciona una rutina para asignar</p>

            <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
              {routines.map((routine) => (
                <button
                  key={routine.id}
                  onClick={() => setSelectedRoutine(routine)}
                  className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition ${
                    selectedRoutine?.id === routine.id
                      ? 'border-accent bg-accent/10'
                      : 'border-line bg-gray-800 hover:border-volt/40'
                  }`}
                >
                  <div>
                    <p className="font-semibold text-white">{routine.title}</p>
                    <p className="text-xs text-muted">
                      {routine.is_default ? 'Predeterminada' : 'Personalizada'}
                    </p>
                  </div>
                  {selectedRoutine?.id === routine.id && (
                    <Check className="h-5 w-5 text-accent" />
                  )}
                </button>
              ))}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setShowAssignModal(false)
                  setSelectedRoutine(null)
                }}
                className="h-12 flex-1 rounded-xl border border-line font-bold text-white transition hover:border-volt/50"
              >
                Cancelar
              </button>
              <button
                onClick={handleAssign}
                disabled={!selectedRoutine || assigning}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-accent font-bold text-white transition hover:bg-accent-hover disabled:opacity-40"
              >
                {assigning ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <Check className="h-5 w-5" />
                    Asignar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
