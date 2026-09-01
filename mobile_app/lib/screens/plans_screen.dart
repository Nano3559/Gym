import 'package:flutter/material.dart';
import '../models/plan.dart';
import '../services/supabase_service.dart';
import '../theme/app_theme.dart';
import '../widgets/plan_card.dart';

class PlansScreen extends StatefulWidget {
  const PlansScreen({super.key});

  @override
  State<PlansScreen> createState() => _PlansScreenState();
}

class _PlansScreenState extends State<PlansScreen> {
  late Future<List<Plan>> _planesFuture;

  @override
  void initState() {
    super.initState();
    _planesFuture = SupabaseService.getPlanes();
  }

  Future<void> _recargar() async {
    setState(() {
      _planesFuture = SupabaseService.getPlanes();
    });
    await _planesFuture;
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: RefreshIndicator(
        onRefresh: _recargar,
        color: AppColors.primary,
        backgroundColor: AppColors.surface,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Planes', style: Theme.of(context).textTheme.displayLarge),
              const SizedBox(height: 6),
              Text(
                'Elige la membresía que se adapte a ti',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 24),
              FutureBuilder<List<Plan>>(
                future: _planesFuture,
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return const Padding(
                      padding: EdgeInsets.symmetric(vertical: 60),
                      child: Center(
                        child: CircularProgressIndicator(color: AppColors.primary),
                      ),
                    );
                  }

                  if (snapshot.hasError) {
                    return _ErrorState(
                      mensaje: 'No se pudieron cargar los planes.\n${snapshot.error}',
                      onReintentar: _recargar,
                    );
                  }

                  final planes = snapshot.data ?? [];
                  if (planes.isEmpty) {
                    return const _ErrorState(
                      mensaje: 'Todavía no hay planes activos registrados.',
                    );
                  }

                  return Column(
                    children: List.generate(planes.length, (i) {
                      final plan = planes[i];
                      // Resaltamos el plan de en medio como "más elegido",
                      // igual que en la web (Plan Completo).
                      final destacado = planes.length >= 2 && i == 1;
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 16),
                        child: PlanCard(
                          plan: plan,
                          destacado: destacado,
                          onElegir: () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('Elegiste: ${plan.nombre}')),
                            );
                          },
                        ),
                      );
                    }),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  final String mensaje;
  final VoidCallback? onReintentar;

  const _ErrorState({required this.mensaje, this.onReintentar});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 40),
      child: Column(
        children: [
          const Icon(Icons.error_outline, color: AppColors.textMuted, size: 40),
          const SizedBox(height: 12),
          Text(
            mensaje,
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.textSecondary),
          ),
          if (onReintentar != null) ...[
            const SizedBox(height: 16),
            OutlinedButton(onPressed: onReintentar, child: const Text('Reintentar')),
          ],
        ],
      ),
    );
  }
}
