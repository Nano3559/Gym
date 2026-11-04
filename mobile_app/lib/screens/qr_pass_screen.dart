import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../models/user_profile.dart';
import '../services/auth_service.dart';
import '../theme/app_theme.dart';

class QrPassScreen extends StatefulWidget {
  const QrPassScreen({super.key});

  @override
  State<QrPassScreen> createState() => _QrPassScreenState();
}

class _QrPassScreenState extends State<QrPassScreen>
    with SingleTickerProviderStateMixin {
  UserProfile? _profile;
  bool _isLoading = true;
  String? _qrData;
  late AnimationController _shimmerController;
  late Animation<double> _shimmerAnimation;

  @override
  void initState() {
    super.initState();
    _shimmerController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);
    _shimmerAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _shimmerController, curve: Curves.easeInOut),
    );
    _loadProfile();
  }

  @override
  void dispose() {
    _shimmerController.dispose();
    super.dispose();
  }

  Future<void> _loadProfile() async {
    setState(() => _isLoading = true);
    final profile = await AuthService.getProfile();
    if (mounted) {
      setState(() {
        _profile = profile;
        _qrData = _buildQrPayload(profile);
        _isLoading = false;
      });
    }
  }

  /// Construye el payload JSON que se codifica dentro del QR.
  /// Incluye timestamp Unix para invalidar QRs viejos (> 5 min).
  String _buildQrPayload(UserProfile? profile) {
    if (profile == null) return '';
    final payload = {
      'uid': profile.id,
      'ci': profile.ci ?? '',
      'nombre': profile.nombreCompleto,
      'plan': profile.planNombre ?? 'Sin plan',
      'vence': profile.fechaVencimiento?.toIso8601String().substring(0, 10) ?? '',
      'activo': profile.tieneMembresiaActiva,
      'ts': DateTime.now().millisecondsSinceEpoch ~/ 1000,
    };
    return jsonEncode(payload);
  }

  String _formatFecha(DateTime? fecha) {
    if (fecha == null) return '—';
    const meses = [
      'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
      'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
    ];
    return '${fecha.day} ${meses[fecha.month - 1]} ${fecha.year}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Mi Pase Digital'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Regenerar QR',
            onPressed: _loadProfile,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _profile == null
              ? _buildErrorState()
              : _buildPassContent(),
    );
  }

  Widget _buildErrorState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, color: AppColors.danger, size: 56),
            const SizedBox(height: 16),
            const Text(
              'No se pudo cargar tu perfil',
              style: TextStyle(
                color: AppColors.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Verifica tu conexión e intenta de nuevo.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textSecondary),
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: _loadProfile,
              child: const Text('Reintentar'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPassContent() {
    final profile = _profile!;
    final isActive = profile.tieneMembresiaActiva;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          // ── Tarjeta del pase ──
          Container(
            width: double.infinity,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: isActive
                    ? [const Color(0xFF1a1a2e), const Color(0xFF16213e)]
                    : [AppColors.surfaceVariant, AppColors.surface],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(24),
              border: Border.all(
                color: isActive ? AppColors.primary.withValues(alpha: 0.5) : AppColors.border,
                width: 1.5,
              ),
              boxShadow: isActive
                  ? [
                      BoxShadow(
                        color: AppColors.primary.withValues(alpha: 0.25),
                        blurRadius: 24,
                        offset: const Offset(0, 8),
                      )
                    ]
                  : [],
            ),
            child: Column(
              children: [
                // Header del pase
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(
                          Icons.fitness_center,
                          color: AppColors.primary,
                          size: 20,
                        ),
                      ),
                      const SizedBox(width: 10),
                      const Text(
                        'IronForge Gym',
                        style: TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const Spacer(),
                      _buildStatusBadge(isActive),
                    ],
                  ),
                ),

                const SizedBox(height: 24),

                // QR con efecto shimmer
                AnimatedBuilder(
                  animation: _shimmerAnimation,
                  builder: (context, child) {
                    return Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(18),
                        boxShadow: [
                          BoxShadow(
                            color: isActive
                                ? AppColors.primary.withValues(
                                    alpha: 0.15 + _shimmerAnimation.value * 0.25)
                                : Colors.black.withValues(alpha: 0.1),
                            blurRadius: 20 + _shimmerAnimation.value * 10,
                            spreadRadius: _shimmerAnimation.value * 4,
                          ),
                        ],
                      ),
                      child: _qrData != null && _qrData!.isNotEmpty
                          ? QrImageView(
                              data: _qrData!,
                              version: QrVersions.auto,
                              size: 200,
                              backgroundColor: Colors.white,
                              eyeStyle: const QrEyeStyle(
                                eyeShape: QrEyeShape.square,
                                color: Color(0xFF1a1a2e),
                              ),
                              dataModuleStyle: const QrDataModuleStyle(
                                dataModuleShape: QrDataModuleShape.square,
                                color: Color(0xFF1a1a2e),
                              ),
                            )
                          : const SizedBox(
                              width: 200,
                              height: 200,
                              child: Center(
                                child: Text(
                                  'Sin datos',
                                  style: TextStyle(color: Colors.grey),
                                ),
                              ),
                            ),
                    );
                  },
                ),

                const SizedBox(height: 20),

                // Datos del socio
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Column(
                    children: [
                      Text(
                        profile.nombreCompleto,
                        style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      if (profile.ci != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          'CI: ${profile.ci}',
                          style: const TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 14,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),

                const SizedBox(height: 16),

                // Divider
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Divider(
                    color: AppColors.border.withValues(alpha: 0.5),
                    height: 1,
                  ),
                ),
                const SizedBox(height: 16),

                // Info de membresía
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                  child: Row(
                    children: [
                      Expanded(
                        child: _InfoTile(
                          label: 'Plan',
                          value: profile.planNombre ?? 'Sin plan',
                          icon: Icons.card_membership_outlined,
                        ),
                      ),
                      Container(
                        width: 1,
                        height: 40,
                        color: AppColors.border.withValues(alpha: 0.4),
                      ),
                      Expanded(
                        child: _InfoTile(
                          label: 'Vence',
                          value: _formatFecha(profile.fechaVencimiento),
                          icon: Icons.calendar_today_outlined,
                        ),
                      ),
                      if (isActive) ...[
                        Container(
                          width: 1,
                          height: 40,
                          color: AppColors.border.withValues(alpha: 0.4),
                        ),
                        Expanded(
                          child: _InfoTile(
                            label: 'Días',
                            value: '${profile.diasRestantes}d',
                            icon: Icons.timer_outlined,
                            valueColor: profile.diasRestantes <= 7
                                ? AppColors.warning
                                : AppColors.accentLime,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),

          // Aviso de validez del QR
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              children: [
                const Icon(Icons.info_outline, color: AppColors.textMuted, size: 18),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Este QR es válido por 5 minutos. Toca el botón ↻ para regenerarlo si el escáner lo rechaza.',
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 12),

          // Botón regenerar
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              icon: const Icon(Icons.qr_code_2),
              label: const Text('Regenerar Pase QR'),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.primary,
                side: const BorderSide(color: AppColors.primary),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              onPressed: _loadProfile,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusBadge(bool isActive) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: isActive
            ? AppColors.success.withValues(alpha: 0.15)
            : AppColors.danger.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isActive
              ? AppColors.success.withValues(alpha: 0.4)
              : AppColors.danger.withValues(alpha: 0.4),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              color: isActive ? AppColors.success : AppColors.danger,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 5),
          Text(
            isActive ? 'ACTIVO' : 'INACTIVO',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              color: isActive ? AppColors.success : AppColors.danger,
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoTile extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color? valueColor;

  const _InfoTile({
    required this.label,
    required this.value,
    required this.icon,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Icon(icon, color: AppColors.textMuted, size: 16),
        const SizedBox(height: 4),
        Text(
          value,
          style: TextStyle(
            color: valueColor ?? AppColors.textPrimary,
            fontSize: 14,
            fontWeight: FontWeight.w700,
          ),
        ),
        Text(
          label,
          style: const TextStyle(
            color: AppColors.textMuted,
            fontSize: 11,
          ),
        ),
      ],
    );
  }
}
