/// Representa una fila de la tabla `planes` en Supabase.
class Plan {
  final String id;
  final String? codigo;
  final String nombre;
  final String descripcion;
  final double precio;
  final int duracionDias;
  final bool activo;

  Plan({
    required this.id,
    this.codigo,
    required this.nombre,
    required this.descripcion,
    required this.precio,
    required this.duracionDias,
    required this.activo,
  });

  factory Plan.fromMap(Map<String, dynamic> map) {
    return Plan(
      id: map['id'] as String,
      codigo: map['codigo'] as String?,
      nombre: map['nombre'] as String,
      descripcion: map['descripcion'] as String? ?? '',
      precio: (map['precio'] as num).toDouble(),
      duracionDias: map['duracion_dias'] as int? ?? 30,
      activo: map['activo'] as bool? ?? true,
    );
  }

  String get precioFormateado => 'Bs. ${precio.toStringAsFixed(0)}';
}

/// Datos de ejemplo para poder ver la pantalla mientras se prueba,
/// o si Supabase no responde. No se usan si la consulta real funciona.
final List<Plan> mockPlanes = [
  Plan(
    id: '1',
    codigo: 'basico',
    nombre: 'Plan Básico',
    descripcion: 'Para empezar tu transformación',
    precio: 150,
    duracionDias: 30,
    activo: true,
  ),
  Plan(
    id: '2',
    codigo: 'completo',
    nombre: 'Plan Completo',
    descripcion: 'El favorito de nuestros socios',
    precio: 240,
    duracionDias: 30,
    activo: true,
  ),
  Plan(
    id: '3',
    codigo: 'premium',
    nombre: 'Plan Premium',
    descripcion: 'Experiencia integral',
    precio: 300,
    duracionDias: 30,
    activo: true,
  ),
];
