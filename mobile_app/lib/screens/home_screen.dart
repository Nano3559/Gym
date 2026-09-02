import 'package:flutter/material.dart';
import '../models/booking.dart';
import '../models/user_profile.dart';
import '../services/auth_service.dart';
import '../services/supabase_service.dart';
import '../theme/app_theme.dart';
import 'login_screen.dart';
import 'my_bookings_screen.dart';

class HomeScreen extends StatefulWidget {
  final VoidCallback onVerPlanes;
  final VoidCallback onVerHorarios;
  final VoidCallback? onVerPaseQR;

  const HomeScreen({
    super.key,
    required this.onVerPlanes,
    required this.onVerHorarios,
    this.onVerPaseQR,
  });

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  UserProfile? _profile;
  Booking? _nextBooking;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadUserData();
  }

  Future<void> _loadUserData() async {
    setState(() => _isLoading = true);

    if (AuthService.isAuthenticated) {
      final prof = await AuthService.getProfile();
      final bookings = await SupabaseService.getMisReservas();
      
      final activeBookings = bookings.where((b) => b.isConfirmed).toList();
      activeBookings.sort((a, b) => a.classDate.compareTo(b.classDate));

      if (mounted) {
        setState(() {
          _profile = prof;
          _nextBooking = activeBookings.isNotEmpty ? activeBookings.first : null;
          _isLoading = false;
        });
      }
    } else {
      if (mounted) {
        setState(() {
          _profile = null;
          _nextBooking = null;
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _handleProfileTap() async {
    if (!AuthService.isAuthenticated) {
      final loggedIn = await Navigator.of(context).push<bool>(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
      if (loggedIn == true) {
        _loadUserData();
      }
      return;
    }

    // Modal de opciones de cuenta
    if (!mounted) return;
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  CircleAvatar(
                    radius: 26,
                    backgroundColor: AppColors.primary,
                    child: Text(
                      (_profile?.nombre.isNotEmpty == true ? _profile!.nombre[0] : 'S').toUpperCase(),
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _profile?.nombreCompleto ?? 'Socio',
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        Text(
                          _profile?.email ?? (AuthService.currentUser?.email ?? ''),
                          style: const TextStyle(
                            fontSize: 13,
                            color: AppColors.textSecondary,
                          ),
                        ),
                        if (_profile?.ci != null)
                          Text(
                            'CI: ${_profile!.ci}',
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.textMuted,
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              const Divider(color: AppColors.border),
              const SizedBox(height: 12),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.event_available_outlined, color: AppColors.primary),
                title: const Text('Mis Reservas', style: TextStyle(color: AppColors.textPrimary)),
                trailing: const Icon(Icons.arrow_forward_ios, size: 14, color: AppColors.textMuted),
                onTap: () {
                  Navigator.of(ctx).pop();
                  _irAMisReservas();
                },
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.logout, color: AppColors.danger),
                title: const Text('Cerrar Sesión', style: TextStyle(color: AppColors.danger)),
                onTap: () async {
                  await AuthService.signOut();
                  if (ctx.mounted) Navigator.of(ctx).pop();
                  _loadUserData();
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Sesión cerrada correctamente.')),
                    );
                  }
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _irAMisReservas() async {
    if (!AuthService.isAuthenticated) {
      final loggedIn = await Navigator.of(context).push<bool>(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
      if (loggedIn != true) return;
    }

    if (!mounted) return;
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const MyBookingsScreen()),
    );
    _loadUserData();
  }

  String _formatFecha(DateTime date) {
    const meses = [
      'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
      'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
    ];
    return '${date.day} ${meses[date.month - 1]} ${date.year}';
  }

  @override
  Widget build(BuildContext context) {
    final isAuth = AuthService.isAuthenticated;
    final hasMembership = _profile?.tieneMembresiaActiva ?? false;

    return SafeArea(
      child: RefreshIndicator(
        onRefresh: _loadUserData,
        color: AppColors.primary,
        backgroundColor: AppColors.surface,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Encabezado
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        isAuth ? 'Hola, ${_profile?.nombre ?? 'Socio'} 👋' : 'Hola 👋',
                        style: const TextStyle(color: AppColors.textSecondary, fontSize: 14),
                      ),
                      const SizedBox(height: 2),
                      const Text(
                        'Bienvenido a IronForge',
                        style: TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                  InkWell(
                    onTap: _handleProfileTap,
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: isAuth ? AppColors.primary : AppColors.border,
                        ),
                      ),
                      child: Icon(
                        isAuth ? Icons.person : Icons.login,
                        color: isAuth ? AppColors.primary : AppColors.textPrimary,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),

              // Tarjeta de estado de membresía
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: hasMembership
                        ? [AppColors.primary, AppColors.primaryDark]
                        : [AppColors.surfaceVariant, AppColors.surface],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(
                    color: hasMembership ? Colors.transparent : AppColors.border,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      hasMembership
                          ? (_profile?.planNombre ?? 'MEMBRESÍA ACTIVA').toUpperCase()
                          : isAuth
                              ? 'SIN MEMBRESÍA ACTIVA'
                              : 'EXPERIENCIA IRONFORGE',
                      style: TextStyle(
                        color: hasMembership ? Colors.white70 : AppColors.accentLime,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.6,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      hasMembership
                          ? 'Membresía activa'
                          : isAuth
                              ? 'Activa tu membresía'
                              : 'Entrena sin límites',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      hasMembership
                          ? 'Vence el ${_formatFecha(_profile!.fechaVencimiento!)} · ${_profile!.diasRestantes} días restantes'
                          : isAuth
                              ? 'Elige un plan para comenzar a reservar tus clases.'
                              : 'Inicia sesión para consultar tus horarios y cupos.',
                      style: TextStyle(
                        color: hasMembership ? Colors.white70 : AppColors.textSecondary,
                        fontSize: 13,
                      ),
                    ),
                    if (!hasMembership) ...[
                      const SizedBox(height: 14),
                      ElevatedButton(
                        onPressed: isAuth ? widget.onVerPlanes : _handleProfileTap,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        ),
                        child: Text(
                          isAuth ? 'VER PLANES' : 'INICIAR SESIÓN',
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 24),

              Text('Accesos rápidos', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 12),

              Row(
                children: [
                  Expanded(
                    child: _QuickAction(
                      icon: Icons.card_membership_outlined,
                      label: 'Planes',
                      onTap: widget.onVerPlanes,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _QuickAction(
                      icon: Icons.calendar_today_outlined,
                      label: 'Horarios',
                      onTap: widget.onVerHorarios,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _QuickAction(
                      icon: Icons.qr_code_2,
                      label: 'Mi pase QR',
                      onTap: () {
                        if (widget.onVerPaseQR != null) {
                          widget.onVerPaseQR!();
                        } else {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Pase digital disponible en el siguiente módulo.')),
                          );
                        }
                      },
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _QuickAction(
                      icon: Icons.event_available_outlined,
                      label: 'Mis reservas',
                      onTap: _irAMisReservas,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 28),

              Text('Próxima clase reservada', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 12),
              if (_isLoading)
                const Center(
                  child: Padding(
                    padding: EdgeInsets.all(16),
                    child: CircularProgressIndicator(color: AppColors.primary),
                  ),
                )
              else if (_nextBooking != null)
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.fitness_center, color: AppColors.primary, size: 28),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${_nextBooking!.className} — ${_nextBooking!.classTime}',
                              style: const TextStyle(
                                color: AppColors.textPrimary,
                                fontWeight: FontWeight.w700,
                                fontSize: 15,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Coach: ${_nextBooking!.trainer} · ${_formatFecha(_nextBooking!.classDate)}',
                              style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                )
              else
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.calendar_month_outlined, color: AppColors.textMuted, size: 28),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Text(
                          isAuth
                              ? 'No tienes clases próximas reservadas.'
                              : 'Inicia sesión para consultar tus reservas.',
                          style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _QuickAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _QuickAction({required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 18),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          children: [
            Icon(icon, color: AppColors.primary),
            const SizedBox(height: 8),
            Text(
              label,
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
