class Booking {
  final String id;
  final String userId;
  final String classId;
  final String status;
  final DateTime createdAt;
  final String className;
  final DateTime classDate;
  final String classTime;
  final String trainer;

  Booking({
    required this.id,
    required this.userId,
    required this.classId,
    required this.status,
    required this.createdAt,
    required this.className,
    required this.classDate,
    required this.classTime,
    required this.trainer,
  });

  bool get isConfirmed => status.toLowerCase() == 'confirmada';

  factory Booking.fromMap(Map<String, dynamic> map) {
    final classData = (map['classes'] as Map<String, dynamic>?) ?? {};
    
    DateTime cDate = DateTime.now();
    if (classData['fecha'] != null) {
      cDate = DateTime.tryParse(classData['fecha'].toString()) ?? DateTime.now();
    }

    String cTime = classData['hora_inicio']?.toString() ?? '00:00';
    if (cTime.length >= 5) {
      cTime = cTime.substring(0, 5);
    }

    return Booking(
      id: map['id'] as String,
      userId: (map['user_id'] as String?) ?? '',
      classId: (map['class_id'] as String?) ?? '',
      status: (map['status'] as String?) ?? 'Confirmada',
      createdAt: map['created_at'] != null
          ? DateTime.tryParse(map['created_at'].toString()) ?? DateTime.now()
          : DateTime.now(),
      className: (classData['nombre'] as String?) ?? 'Clase Grupal',
      classDate: cDate,
      classTime: cTime,
      trainer: (classData['entrenador'] as String?) ?? 'Equipo IronForge',
    );
  }
}
