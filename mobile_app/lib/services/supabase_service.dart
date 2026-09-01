import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/plan.dart';
import '../models/gym_class.dart';

/// Capa de acceso a datos, SOLO LECTURA por ahora.
///
/// Importante: esta parte (Módulo 8, punto 1) es responsabilidad visual.
/// La lógica de escritura real (login, crear reservas, sincronizar, etc.)
/// la conecta el Integrante 2 más adelante. No dupliques esa lógica aquí,
/// solo consultamos datos para poder mostrarlos en pantalla.
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

  static String _formatFecha(DateTime fecha) {
    final mes = fecha.month.toString().padLeft(2, '0');
    final dia = fecha.day.toString().padLeft(2, '0');
    return '${fecha.year}-$mes-$dia';
  }
}
