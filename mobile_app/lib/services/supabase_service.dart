import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/plan.dart';
import '../models/gym_class.dart';
import '../models/booking.dart';

class SupabaseService {
  static final SupabaseClient _client = Supabase.instance.client;

  /// Trae todos los planes activos, ordenados de más barato a más caro.
  static Future<List<Plan>> getPlanes() async {
    final data = await _client
        .from('plans')
        .select()
        .eq('activo', true)
        .order('precio', ascending: true);

    return (data as List)
        .map((e) => Plan.fromMap(e as Map<String, dynamic>))
        .toList();
  }

  /// Trae las clases activas de un día específico, ordenadas por hora.
  static Future<List<GymClass>> getClasesPorFecha(DateTime fecha) async {
    final fechaStr = _formatFecha(fecha);

    final data = await _client
        .from('classes')
        .select()
        .eq('fecha', fechaStr)
        .eq('activo', true)
        .order('hora_inicio', ascending: true);

    return (data as List)
        .map((e) => GymClass.fromMap(e as Map<String, dynamic>))
        .toList();
  }

  /// Realiza la reserva de una clase invocando la función RPC `reservar_clase`
  static Future<Map<String, dynamic>> reservarClase(String classId) async {
    try {
      final res = await _client.rpc(
        'reservar_clase',
        params: {'p_class_id': classId},
      );
      return {'ok': true, 'data': res, 'message': 'Reserva realizada correctamente.'};
    } on PostgrestException catch (e) {
      return {'ok': false, 'message': e.message};
    } catch (e) {
      return {'ok': false, 'message': 'Error inesperado al realizar la reserva: $e'};
    }
  }

  /// Trae las reservas del usuario actual junto con los datos de cada clase
  static Future<List<Booking>> getMisReservas() async {
    final user = _client.auth.currentUser;
    if (user == null) return [];

    try {
      final data = await _client
          .from('bookings')
          .select('id, user_id, class_id, estado, created_at, classes(nombre, fecha, hora_inicio, entrenador)')
          .eq('user_id', user.id)
          .order('created_at', ascending: false);

      return (data as List).map((item) {
        final map = item as Map<String, dynamic>;
        return Booking.fromMap({
          'id': map['id'],
          'user_id': map['user_id'],
          'class_id': map['class_id'],
          'status': map['estado'] ?? 'Confirmada',
          'created_at': map['created_at'],
          'classes': map['classes'],
        });
      }).toList();
    } catch (e) {
      return [];
    }
  }

  /// Cancela una reserva existente
  static Future<Map<String, dynamic>> cancelarReserva(String bookingId) async {
    try {
      await _client
          .from('bookings')
          .update({'estado': 'cancelada'})
          .eq('id', bookingId);
      return {'ok': true, 'message': 'Reserva cancelada correctamente.'};
    } on PostgrestException catch (e) {
      return {'ok': false, 'message': e.message};
    } catch (e) {
      return {'ok': false, 'message': 'No se pudo cancelar la reserva: $e'};
    }
  }

  static String _formatFecha(DateTime fecha) {
    final mes = fecha.month.toString().padLeft(2, '0');
    final dia = fecha.day.toString().padLeft(2, '0');
    return '${fecha.year}-$mes-$dia';
  }
}
