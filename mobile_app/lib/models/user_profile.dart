class UserProfile {
  final String id;
  final String nombre;
  final String apellido;
  final String? ci;
  final String telefono;
  final String? fechaNacimiento;
  final String email;
  final String? direccion;
  final String? contactoEmergencia;
  final String? planId;
  final String? planNombre;
  final String? planCodigo;
  final DateTime? fechaVencimiento;
  final String? estadoMembresia;

  UserProfile({
    required this.id,
    required this.nombre,
    required this.apellido,
    this.ci,
    required this.telefono,
    this.fechaNacimiento,
    required this.email,
    this.direccion,
    this.contactoEmergencia,
    this.planId,
    this.planNombre,
    this.planCodigo,
    this.fechaVencimiento,
    this.estadoMembresia,
  });

  String get nombreCompleto => '$nombre $apellido'.trim();

  bool get tieneMembresiaActiva {
    if (fechaVencimiento == null) return false;
    return fechaVencimiento!.isAfter(DateTime.now()) &&
        (estadoMembresia == null || estadoMembresia == 'activa' || estadoMembresia == 'por_vencer');
  }

  int get diasRestantes {
    if (fechaVencimiento == null) return 0;
    final diff = fechaVencimiento!.difference(DateTime.now()).inDays;
    return diff > 0 ? diff : 0;
  }

  factory UserProfile.fromMap(Map<String, dynamic> map, {Map<String, dynamic>? membershipMap}) {
    DateTime? vtoDate;
    String? estado;
    String? pNombre;
    String? pCodigo;

    if (membershipMap != null) {
      if (membershipMap['fecha_vencimiento'] != null) {
        vtoDate = DateTime.tryParse(membershipMap['fecha_vencimiento'].toString());
      }
      estado = membershipMap['estado'] as String?;
      if (membershipMap['plans'] is Map) {
        final planData = membershipMap['plans'] as Map<String, dynamic>;
        pNombre = planData['nombre'] as String?;
        pCodigo = planData['codigo'] as String?;
      }
    }

    return UserProfile(
      id: map['id'] as String,
      nombre: (map['nombre'] as String?) ?? 'Socio',
      apellido: (map['apellido'] as String?) ?? '',
      ci: map['ci'] as String?,
      telefono: (map['telefono'] as String?) ?? '',
      fechaNacimiento: map['fecha_nacimiento'] as String?,
      email: (map['email'] as String?) ?? '',
      direccion: map['direccion'] as String?,
      contactoEmergencia: map['contacto_emergencia'] as String?,
      planId: map['plan_id'] as String?,
      planNombre: pNombre,
      planCodigo: pCodigo,
      fechaVencimiento: vtoDate,
      estadoMembresia: estado,
    );
  }
}
