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

  /// Verifica si el usuario actual tiene rol de administrador.
  /// Consulta el campo `rol` en la tabla `profiles`.
  static Future<bool> esAdmin() async {
    final user = _client.auth.currentUser;
    if (user == null) return false;
    try {
      final data = await _client
          .from('profiles')
          .select('rol')
          .eq('id', user.id)
          .maybeSingle();
      return data != null && data['rol'] == 'admin';
    } catch (_) {
      return false;
    }
  }

  /// Valida si un socio tiene membresía activa. Usado por el escáner del admin.
  /// Recibe el [uid] (UUID del usuario en Supabase Auth) leído del QR.
  /// Retorna:
  ///   - ok: true si el acceso está permitido
  ///   - nombre, plan, vence: datos del socio para mostrar en pantalla
  ///   - message: descripción del resultado o motivo de denegación
  static Future<Map<String, dynamic>> validarQr(String uid) async {
    try {
      // 1. Obtener datos del perfil
      final profileData = await _client
          .from('profiles')
          .select('nombre, apellido')
          .eq('id', uid)
          .maybeSingle();

      if (profileData == null) {
        return {
          'ok': false,
          'nombre': 'Desconocido',
          'message': 'El socio no existe en el sistema.',
        };
      }

      final nombre =
          '${profileData['nombre'] ?? ''} ${profileData['apellido'] ?? ''}'.trim();

      // 2. Verificar membresía activa
      final memData = await _client
          .from('memberships')
          .select('estado, fecha_vencimiento, plans(nombre)')
          .eq('user_id', uid)
          .order('created_at', ascending: false)
          .limit(1)
          .maybeSingle();

      if (memData == null) {
        return {
          'ok': false,
          'nombre': nombre,
          'plan': 'Sin plan',
          'vence': '—',
          'message': 'El socio no tiene ninguna membresía registrada.',
        };
      }

      final estado = memData['estado'] as String? ?? '';
      final fechaVenStr = memData['fecha_vencimiento'] as String?;
      final planNombre =
          (memData['plans'] as Map<String, dynamic>?)?['nombre'] as String? ??
              '—';

      DateTime? fechaVencimiento;
      if (fechaVenStr != null) {
        fechaVencimiento = DateTime.tryParse(fechaVenStr);
      }

      final ahora = DateTime.now();
      final vigente =
          fechaVencimiento != null && fechaVencimiento.isAfter(ahora);
      final estadoOk = estado == 'activa' || estado == 'por_vencer';

      final venceStr = fechaVencimiento != null
          ? '${fechaVencimiento.day}/${fechaVencimiento.month}/${fechaVencimiento.year}'
          : '—';

      if (!vigente || !estadoOk) {
        return {
          'ok': false,
          'nombre': nombre,
          'plan': planNombre,
          'vence': venceStr,
          'message': vigente
              ? 'La membresía está suspendida o cancelada.'
              : 'La membresía venció el $venceStr.',
        };
      }

      return {
        'ok': true,
        'nombre': nombre,
        'plan': planNombre,
        'vence': venceStr,
        'message': 'Acceso permitido.',
      };
    } on PostgrestException catch (e) {
      return {'ok': false, 'nombre': '—', 'message': e.message};
    } catch (e) {
      return {
        'ok': false,
        'nombre': '—',
        'message': 'Error al verificar acceso: $e',
      };
    }
  }

  static String _formatFecha(DateTime fecha) {
    final mes = fecha.month.toString().padLeft(2, '0');
    final dia = fecha.day.toString().padLeft(2, '0');
    return '${fecha.year}-$mes-$dia';
  }
}
