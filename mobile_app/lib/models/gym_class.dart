/// Representa una fila de la tabla `clases` en Supabase.
class GymClass {
  final String id;
  final String nombre;
  final String? descripcion;
  final DateTime fecha;
  final String horaInicio; // formato "HH:mm"
  final String? horaFin;
  final int capacidad;
  final String entrenador;
  final bool activo;
  final int reservasCount;

  GymClass({
    required this.id,
    required this.nombre,
    this.descripcion,
    required this.fecha,
    required this.horaInicio,
    this.horaFin,
    required this.capacidad,
    required this.entrenador,
    required this.activo,
    required this.reservasCount,
  });

  factory GymClass.fromMap(Map<String, dynamic> map) {
    return GymClass(
      id: map['id'] as String,
      nombre: map['nombre'] as String,
      descripcion: map['descripcion'] as String?,
      fecha: DateTime.parse(map['fecha'] as String),
      horaInicio: _formatHora(map['hora_inicio'] as String),
      horaFin:
          map['hora_fin'] != null ? _formatHora(map['hora_fin'] as String) : null,
      capacidad: map['capacidad'] as int,
      entrenador: map['entrenador'] as String,
      activo: map['activo'] as bool? ?? true,
      reservasCount: map['reservas_count'] as int? ?? 0,
    );
  }

  static String _formatHora(String raw) {
    // Supabase suele devolver "HH:mm:ss", nos quedamos solo con "HH:mm"
    return raw.length >= 5 ? raw.substring(0, 5) : raw;
  }

  int get cuposDisponibles => capacidad - reservasCount;
  bool get estaLlena => cuposDisponibles <= 0;
}

/// Datos de ejemplo para diseñar/probar la pantalla sin depender de la BD.
final List<GymClass> mockClases = [
  GymClass(
    id: '1',
    nombre: 'CrossFit',
    fecha: DateTime.now(),
    horaInicio: '07:00',
    capacidad: 20,
    entrenador: 'Carlos Pérez',
    activo: true,
    reservasCount: 14,
  ),
  GymClass(
    id: '2',
    nombre: 'Spinning',
    fecha: DateTime.now(),
    horaInicio: '09:00',
    capacidad: 15,
    entrenador: 'María López',
    activo: true,
    reservasCount: 15,
  ),
  GymClass(
    id: '3',
    nombre: 'Yoga',
    fecha: DateTime.now(),
    horaInicio: '20:00',
    capacidad: 12,
    entrenador: 'María López',
    activo: true,
    reservasCount: 5,
  ),
];
