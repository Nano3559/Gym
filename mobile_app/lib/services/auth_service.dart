import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/user_profile.dart';

class AuthService {
  static final SupabaseClient _client = Supabase.instance.client;

  /// Usuario autenticado actual de Supabase Auth
  static User? get currentUser => _client.auth.currentUser;

  /// Indica si hay una sesión activa
  static bool get isAuthenticated => _client.auth.currentUser != null;

  /// Stream para escuchar cambios en el estado de autenticación
  static Stream<AuthState> get authStateChanges => _client.auth.onAuthStateChange;

  /// Inicia sesión con correo y contraseña
  static Future<AuthResponse> signIn({
    required String email,
    required String password,
  }) async {
    final response = await _client.auth.signInWithPassword(
      email: email.trim(),
      password: password,
    );
    return response;
  }

  /// Registra un nuevo socio con todos sus datos de perfil
  static Future<AuthResponse> signUp({
    required String email,
    required String password,
    required String nombre,
    required String apellido,
    required String ci,
    required String telefono,
    String? fechaNacimiento,
    String? direccion,
    String? contactoEmergencia,
  }) async {
    final response = await _client.auth.signUp(
      email: email.trim(),
      password: password,
      data: {
        'nombre': nombre.trim(),
        'apellido': apellido.trim(),
        'ci': ci.trim(),
        'telefono': telefono.trim(),
        if (fechaNacimiento != null && fechaNacimiento.isNotEmpty)
          'fecha_nacimiento': fechaNacimiento,
        if (direccion != null && direccion.isNotEmpty)
          'direccion': direccion.trim(),
        if (contactoEmergencia != null && contactoEmergencia.isNotEmpty)
          'contacto_emergencia': contactoEmergencia.trim(),
      },
    );
    return response;
  }

  /// Cierra la sesión activa
  static Future<void> signOut() async {
    await _client.auth.signOut();
  }

  /// Obtiene los datos del perfil y la membresía del socio actual
  static Future<UserProfile?> getProfile() async {
    final user = currentUser;
    if (user == null) return null;

    try {
      final profileData = await _client
          .from('profiles')
          .select()
          .eq('id', user.id)
          .maybeSingle();

      if (profileData == null) return null;

      // Consultar membresía activa si existe
      Map<String, dynamic>? membershipData;
      try {
        final memRes = await _client
            .from('memberships')
            .select('fecha_vencimiento, estado, plans(nombre, codigo)')
            .eq('user_id', user.id)
            .order('created_at', ascending: false)
            .limit(1)
            .maybeSingle();
        membershipData = memRes;
      } catch (_) {
        // En caso de que aún no tenga membresía en la tabla
      }

      return UserProfile.fromMap(
        profileData,
        membershipMap: membershipData,
      );
    } catch (e) {
      return null;
    }
  }
}
