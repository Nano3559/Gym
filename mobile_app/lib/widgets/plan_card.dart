import 'package:flutter/material.dart';
import '../models/plan.dart';
import '../theme/app_theme.dart';

class PlanCard extends StatelessWidget {
  final Plan plan;
  final bool destacado;
  final VoidCallback? onElegir;

  const PlanCard({
    super.key,
    required this.plan,
    this.destacado = false,
    this.onElegir,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: destacado ? AppColors.primary : AppColors.border,
          width: destacado ? 1.5 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (destacado)
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Text(
                'MÁS ELEGIDO',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                  letterSpacing: 0.5,
                ),
              ),
            ),
          Text(plan.nombre, style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 6),
          Text(plan.descripcion, style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 16),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                plan.precioFormateado,
                style: const TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w900,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(width: 6),
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text(
                  '/ ${plan.duracionDias} días',
                  style: const TextStyle(color: AppColors.textMuted, fontSize: 13),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: destacado
                ? ElevatedButton(
                    onPressed: onElegir,
                    child: const Text('ELEGIR ESTE PLAN'),
                  )
                : OutlinedButton(
                    onPressed: onElegir,
                    child: const Text('ELEGIR ESTE PLAN'),
                  ),
          ),
        ],
      ),
    );
  }
}
