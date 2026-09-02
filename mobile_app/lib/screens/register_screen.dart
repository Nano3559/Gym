import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../services/auth_service.dart';
import '../theme/app_theme.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();

  final _nombreController = TextEditingController();
  final _apellidoController = TextEditingController();
  final _ciController = TextEditingController();
  final _telefonoController = TextEditingController();
  final _emailController = TextEditingController();
  final _direccionController = TextEditingController();
  final _emergenciaController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  DateTime? _fechaNacimiento;
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  bool _isLoading = false;

  @override
  void dispose() {
    _nombreController.dispose();
    _apellidoController.dispose();
    _ciController.dispose();
    _telefonoController.dispose();
    _emailController.dispose();
    _direccionController.dispose();
    _emergenciaController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _selectFechaNacimiento() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _fechaNacimiento ?? DateTime(now.year - 20, 1, 1),
      firstDate: DateTime(1940),
      lastDate: now,
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.dark(
              primary: AppColors.primary,
              onPrimary: Colors.white,
              surface: AppColors.surface,
              onSurface: AppColors.textPrimary,
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      setState(() => _fechaNacimiento = picked);
    }
  }

  String _formatDate(DateTime d) {
    final mes = d.month.toString().padLeft(2, '0');
    final dia = d.day.toString().padLeft(2, '0');
    return '${d.year}-$mes-$dia';
  }

  Future<void> _handleRegister() async {
    if (!_formKey.currentState!.validate()) return;

    if (_fechaNacimiento == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: AppColors.danger,
          content: Text('Por favor selecciona tu fecha de nacimiento'),
        ),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      final res = await AuthService.signUp(
        email: _emailController.text,
        password: _passwordController.text,
        nombre: _nombreController.text,
        apellido: _apellidoController.text,
        ci: _ciController.text,
        telefono: _telefonoController.text,
        fechaNacimiento: _fechaNacimiento != null ? _formatDate(_fechaNacimiento!) : null,
        direccion: _direccionController.text,
        contactoEmergencia: _emergenciaController.text,
      );

      if (mounted) {
        if (res.session != null) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              backgroundColor: AppColors.success,
              content: Text('¡Bienvenido/a, ${_nombreController.text}! Cuenta creada con éxito.'),
            ),
          );
          Navigator.of(context).pop(true);
        } else {
          // Si Supabase requiere confirmación por email
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              backgroundColor: AppColors.warning,
              content: Text(
                'Registro exitoso. Si tienes confirmación de correo activa, revisa tu bandeja de entrada.',
                style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold),
              ),
            ),
          );
          Navigator.of(context).pop(true);
        }
      }
    } on AuthException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: AppColors.danger,
            content: Text(e.message),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: AppColors.danger,
            content: Text('Error al registrar: $e'),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  InputDecoration _inputDecoration({
    required String hintText,
    required IconData icon,
    Widget? suffixIcon,
  }) {
    return InputDecoration(
      hintText: hintText,
      hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 13),
      filled: true,
      fillColor: AppColors.surface,
      prefixIcon: Icon(icon, color: AppColors.textMuted, size: 20),
      suffixIcon: suffixIcon,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.primary, width: 2),
      ),
    );
  }

  Widget _label(String text, {bool required = true}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          Text(
            text,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          if (required)
            const Text(
              ' *',
              style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Registro de Socio'),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => Navigator.of(context).pop(false),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Crea tu cuenta',
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Completa tus datos para inscribirte y reservar clases en IronForge.',
                  style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
                ),
                const SizedBox(height: 24),

                // Nombres y Apellidos
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _label('Nombre'),
                          TextFormField(
                            controller: _nombreController,
                            style: const TextStyle(color: AppColors.textPrimary),
                            decoration: _inputDecoration(hintText: 'Juan', icon: Icons.person_outline),
                            validator: (v) => v == null || v.trim().isEmpty ? 'Requerido' : null,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _label('Apellido'),
                          TextFormField(
                            controller: _apellidoController,
                            style: const TextStyle(color: AppColors.textPrimary),
                            decoration: _inputDecoration(hintText: 'Pérez', icon: Icons.person_outline),
                            validator: (v) => v == null || v.trim().isEmpty ? 'Requerido' : null,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // Cédula de Identidad (CI) y Teléfono
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _label('Cédula de Identidad'),
                          TextFormField(
                            controller: _ciController,
                            keyboardType: TextInputType.number,
                            style: const TextStyle(color: AppColors.textPrimary),
                            decoration: _inputDecoration(hintText: '7894561', icon: Icons.badge_outlined),
                            validator: (v) => v == null || v.trim().isEmpty ? 'Requerido' : null,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _label('Teléfono'),
                          TextFormField(
                            controller: _telefonoController,
                            keyboardType: TextInputType.phone,
                            style: const TextStyle(color: AppColors.textPrimary),
                            decoration: _inputDecoration(hintText: '+591 7XXXXXXX', icon: Icons.phone_outlined),
                            validator: (v) => v == null || v.trim().isEmpty ? 'Requerido' : null,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // Correo Electrónico
                _label('Correo Electrónico'),
                TextFormField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  style: const TextStyle(color: AppColors.textPrimary),
                  decoration: _inputDecoration(hintText: 'juan.perez@correo.com', icon: Icons.email_outlined),
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) return 'Ingresa tu correo';
                    if (!v.contains('@') || !v.contains('.')) return 'Correo inválido';
                    return null;
                  },
                ),
                const SizedBox(height: 16),

                // Fecha de Nacimiento
                _label('Fecha de Nacimiento'),
                InkWell(
                  onTap: _selectFechaNacimiento,
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.cake_outlined, color: AppColors.textMuted, size: 20),
                        const SizedBox(width: 12),
                        Text(
                          _fechaNacimiento != null
                              ? _formatDate(_fechaNacimiento!)
                              : 'Seleccionar fecha',
                          style: TextStyle(
                            color: _fechaNacimiento != null
                                ? AppColors.textPrimary
                                : AppColors.textMuted,
                            fontSize: 14,
                          ),
                        ),
                        const Spacer(),
                        const Icon(Icons.calendar_month, color: AppColors.primary, size: 20),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Dirección
                _label('Dirección', required: false),
                TextFormField(
                  controller: _direccionController,
                  style: const TextStyle(color: AppColors.textPrimary),
                  decoration: _inputDecoration(hintText: 'Av. Las Palmas #123, Santa Cruz', icon: Icons.location_on_outlined),
                ),
                const SizedBox(height: 16),

                // Contacto de Emergencia
                _label('Contacto de Emergencia'),
                TextFormField(
                  controller: _emergenciaController,
                  style: const TextStyle(color: AppColors.textPrimary),
                  decoration: _inputDecoration(hintText: 'Mamá: +591 71234567', icon: Icons.contact_emergency_outlined),
                  validator: (v) => v == null || v.trim().isEmpty ? 'Ingresa un contacto de emergencia' : null,
                ),
                const SizedBox(height: 16),

                // Contraseña
                _label('Contraseña'),
                TextFormField(
                  controller: _passwordController,
                  obscureText: _obscurePassword,
                  style: const TextStyle(color: AppColors.textPrimary),
                  decoration: _inputDecoration(
                    hintText: 'Mínimo 6 caracteres',
                    icon: Icons.lock_outline,
                    suffixIcon: IconButton(
                      icon: Icon(
                        _obscurePassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                        color: AppColors.textMuted,
                      ),
                      onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                    ),
                  ),
                  validator: (v) {
                    if (v == null || v.isEmpty) return 'Ingresa una contraseña';
                    if (v.length < 6) return 'Mínimo 6 caracteres';
                    return null;
                  },
                ),
                const SizedBox(height: 16),

                // Confirmar Contraseña
                _label('Confirmar Contraseña'),
                TextFormField(
                  controller: _confirmPasswordController,
                  obscureText: _obscureConfirmPassword,
                  style: const TextStyle(color: AppColors.textPrimary),
                  decoration: _inputDecoration(
                    hintText: 'Repite tu contraseña',
                    icon: Icons.lock_clock_outlined,
                    suffixIcon: IconButton(
                      icon: Icon(
                        _obscureConfirmPassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                        color: AppColors.textMuted,
                      ),
                      onPressed: () => setState(() => _obscureConfirmPassword = !_obscureConfirmPassword),
                    ),
                  ),
                  validator: (v) {
                    if (v == null || v.isEmpty) return 'Confirma tu contraseña';
                    if (v != _passwordController.text) return 'Las contraseñas no coinciden';
                    return null;
                  },
                ),
                const SizedBox(height: 28),

                // Botón de Registro
                ElevatedButton(
                  onPressed: _isLoading ? null : _handleRegister,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: _isLoading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Text(
                          'REGISTRARME',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.5,
                          ),
                        ),
                ),
                const SizedBox(height: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
