import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../services/supabase_service.dart';
import '../theme/app_theme.dart';

/// Pantalla exclusiva del administrador para escanear y validar
/// el pase QR de un socio. Verifica membresía activa en Supabase
/// y valida que el QR no tenga más de 5 minutos de antigüedad.
class QrScannerScreen extends StatefulWidget {
  const QrScannerScreen({super.key});

  @override
  State<QrScannerScreen> createState() => _QrScannerScreenState();
}

class _QrScannerScreenState extends State<QrScannerScreen> {
  final MobileScannerController _cameraController = MobileScannerController();

  bool _isProcessing = false;
  _ScanResult? _lastResult;
  bool _torchOn = false;

  @override
  void dispose() {
    _cameraController.dispose();
    super.dispose();
  }

  Future<void> _handleDetection(BarcodeCapture capture) async {
    if (_isProcessing) return;

    final rawValue = capture.barcodes.firstOrNull?.rawValue;
    if (rawValue == null || rawValue.isEmpty) return;

    setState(() {
      _isProcessing = true;
      _lastResult = null;
    });

    // Detener la cámara temporalmente mientras procesamos
    await _cameraController.stop();

    final result = await _validateQrPayload(rawValue);

    if (mounted) {
      setState(() {
        _isProcessing = false;
        _lastResult = result;
      });
    }
  }

  /// Decodifica el JSON del QR y valida contra Supabase.
  Future<_ScanResult> _validateQrPayload(String raw) async {
    Map<String, dynamic> payload;

    // 1. Parsear JSON
    try {
      payload = jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      return _ScanResult.denied(
        nombre: 'Desconocido',
        motivo: 'El QR no tiene un formato válido.',
      );
    }

    // 2. Verificar campos mínimos
    final uid = payload['uid'] as String?;
    final nombre = payload['nombre'] as String? ?? 'Socio';
    final plan = payload['plan'] as String? ?? '—';
    final vence = payload['vence'] as String? ?? '—';
    final ts = payload['ts'] as int?;

    if (uid == null || uid.isEmpty) {
      return _ScanResult.denied(
        nombre: nombre,
        motivo: 'El QR no contiene un identificador válido.',
      );
    }

    // 3. Verificar antigüedad del QR (máximo 5 minutos = 300 segundos)
    if (ts != null) {
      final now = DateTime.now().millisecondsSinceEpoch ~/ 1000;
      final diff = now - ts;
      if (diff > 300) {
        return _ScanResult.denied(
          nombre: nombre,
          plan: plan,
          vence: vence,
          motivo: 'El QR expiró hace ${(diff ~/ 60)} min. Pide al socio que regenere su pase.',
        );
      }
    }

    // 4. Validar en Supabase
    final validation = await SupabaseService.validarQr(uid);
    final ok = validation['ok'] == true;
    final dbNombre = validation['nombre'] as String? ?? nombre;
    final dbPlan = validation['plan'] as String? ?? plan;
    final dbVence = validation['vence'] as String? ?? vence;
    final motivo = validation['message'] as String? ?? 'Error al verificar.';

    if (ok) {
      return _ScanResult.allowed(
        nombre: dbNombre,
        plan: dbPlan,
        vence: dbVence,
      );
    } else {
      return _ScanResult.denied(
        nombre: dbNombre,
        plan: dbPlan,
        vence: dbVence,
        motivo: motivo,
      );
    }
  }

  void _reiniciarEscaneo() {
    setState(() {
      _lastResult = null;
      _isProcessing = false;
    });
    _cameraController.start();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        title: const Text(
          'Validar Acceso',
          style: TextStyle(color: Colors.white),
        ),
        iconTheme: const IconThemeData(color: Colors.white),
        actions: [
          IconButton(
            icon: Icon(
              _torchOn ? Icons.flash_on : Icons.flash_off,
              color: _torchOn ? Colors.amber : Colors.white,
            ),
            onPressed: () {
              setState(() => _torchOn = !_torchOn);
              _cameraController.toggleTorch();
            },
            tooltip: 'Linterna',
          ),
        ],
      ),
      body: Stack(
        children: [
          // ── Cámara ──
          MobileScanner(
            controller: _cameraController,
            onDetect: _handleDetection,
          ),

          // ── Marco de escaneo ──
          if (_lastResult == null && !_isProcessing)
            Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _buildScanFrame(),
                  const SizedBox(height: 24),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.black54,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Text(
                      'Apunta la cámara al QR del socio',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),

          // ── Procesando ──
          if (_isProcessing)
            Container(
              color: Colors.black54,
              child: const Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CircularProgressIndicator(color: AppColors.primary),
                    SizedBox(height: 16),
                    Text(
                      'Verificando en servidor...',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ),

          // ── Resultado ──
          if (_lastResult != null)
            _buildResultOverlay(_lastResult!),
        ],
      ),
    );
  }

  Widget _buildScanFrame() {
    const size = 240.0;
    const cornerSize = 24.0;
    const cornerThickness = 4.0;
    final color = AppColors.primary;

    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        children: [
          // Fondo semitransparente interior
          Center(
            child: Container(
              width: size,
              height: size,
              decoration: BoxDecoration(
                border: Border.all(
                  color: Colors.white.withValues(alpha: 0.1),
                  width: 1,
                ),
              ),
            ),
          ),
          // Esquinas
          _Corner(top: 0, left: 0, color: color, size: cornerSize, thickness: cornerThickness),
          _Corner(top: 0, right: 0, color: color, size: cornerSize, thickness: cornerThickness),
          _Corner(bottom: 0, left: 0, color: color, size: cornerSize, thickness: cornerThickness),
          _Corner(bottom: 0, right: 0, color: color, size: cornerSize, thickness: cornerThickness),
        ],
      ),
    );
  }

  Widget _buildResultOverlay(_ScanResult result) {
    final isAllowed = result.allowed;
    final bgColor = isAllowed
        ? const Color(0xFF0a2a0a)
        : const Color(0xFF2a0a0a);
    final accentColor = isAllowed ? AppColors.success : AppColors.danger;

    return Container(
      color: Colors.black87,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: bgColor,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(
                color: accentColor.withValues(alpha: 0.6),
                width: 2,
              ),
              boxShadow: [
                BoxShadow(
                  color: accentColor.withValues(alpha: 0.3),
                  blurRadius: 30,
                  spreadRadius: 5,
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Ícono grande
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: accentColor.withValues(alpha: 0.15),
                    border: Border.all(
                      color: accentColor.withValues(alpha: 0.4),
                      width: 2,
                    ),
                  ),
                  child: Icon(
                    isAllowed ? Icons.check_circle_outline : Icons.cancel_outlined,
                    color: accentColor,
                    size: 56,
                  ),
                ),
                const SizedBox(height: 20),

                // Veredicto
                Text(
                  isAllowed ? 'ACCESO PERMITIDO' : 'ACCESO DENEGADO',
                  style: TextStyle(
                    color: accentColor,
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1,
                  ),
                ),
                const SizedBox(height: 16),

                // Datos del socio
                Text(
                  result.nombre,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                if (result.plan != null) ...[
                  const SizedBox(height: 6),
                  Text(
                    'Plan: ${result.plan}',
                    style: const TextStyle(
                      color: Colors.white70,
                      fontSize: 14,
                    ),
                  ),
                ],
                if (result.vence != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    'Vence: ${result.vence}',
                    style: const TextStyle(
                      color: Colors.white54,
                      fontSize: 13,
                    ),
                  ),
                ],

                // Motivo de denegación
                if (!isAllowed && result.motivo != null) ...[
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.danger.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: AppColors.danger.withValues(alpha: 0.3),
                      ),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.warning_amber_outlined,
                            color: AppColors.warning, size: 18),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            result.motivo!,
                            style: const TextStyle(
                              color: Colors.white70,
                              fontSize: 13,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                const SizedBox(height: 24),

                // Botón escanear de nuevo
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    icon: const Icon(Icons.qr_code_scanner),
                    label: const Text(
                      'Escanear otro socio',
                      style: TextStyle(fontWeight: FontWeight.w700),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    onPressed: _reiniciarEscaneo,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

class _ScanResult {
  final bool allowed;
  final String nombre;
  final String? plan;
  final String? vence;
  final String? motivo;

  _ScanResult({
    required this.allowed,
    required this.nombre,
    this.plan,
    this.vence,
    this.motivo,
  });

  factory _ScanResult.allowed({
    required String nombre,
    String? plan,
    String? vence,
  }) =>
      _ScanResult(allowed: true, nombre: nombre, plan: plan, vence: vence);

  factory _ScanResult.denied({
    required String nombre,
    String? plan,
    String? vence,
    required String motivo,
  }) =>
      _ScanResult(
          allowed: false,
          nombre: nombre,
          plan: plan,
          vence: vence,
          motivo: motivo);
}

/// Widget de esquina del marco de escaneo.
class _Corner extends StatelessWidget {
  final double? top, bottom, left, right;
  final Color color;
  final double size;
  final double thickness;

  const _Corner({
    this.top,
    this.bottom,
    this.left,
    this.right,
    required this.color,
    required this.size,
    required this.thickness,
  });

  @override
  Widget build(BuildContext context) {
    return Positioned(
      top: top,
      bottom: bottom,
      left: left,
      right: right,
      child: SizedBox(
        width: size,
        height: size,
        child: CustomPaint(
          painter: _CornerPainter(
            color: color,
            thickness: thickness,
            isTopLeft: top != null && left != null,
            isTopRight: top != null && right != null,
            isBottomLeft: bottom != null && left != null,
            isBottomRight: bottom != null && right != null,
          ),
        ),
      ),
    );
  }
}

class _CornerPainter extends CustomPainter {
  final Color color;
  final double thickness;
  final bool isTopLeft, isTopRight, isBottomLeft, isBottomRight;

  _CornerPainter({
    required this.color,
    required this.thickness,
    required this.isTopLeft,
    required this.isTopRight,
    required this.isBottomLeft,
    required this.isBottomRight,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = thickness
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.square;

    final path = Path();
    if (isTopLeft) {
      path.moveTo(0, size.height);
      path.lineTo(0, 0);
      path.lineTo(size.width, 0);
    } else if (isTopRight) {
      path.moveTo(0, 0);
      path.lineTo(size.width, 0);
      path.lineTo(size.width, size.height);
    } else if (isBottomLeft) {
      path.moveTo(0, 0);
      path.lineTo(0, size.height);
      path.lineTo(size.width, size.height);
    } else if (isBottomRight) {
      path.moveTo(0, size.height);
      path.lineTo(size.width, size.height);
      path.lineTo(size.width, 0);
    }
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
