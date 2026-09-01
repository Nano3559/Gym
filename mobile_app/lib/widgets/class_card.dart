import 'package:flutter/material.dart';
import '../models/gym_class.dart';
import '../theme/app_theme.dart';

class ClassCard extends StatelessWidget {
  final GymClass gymClass;
  final VoidCallback? onReservar;

  const ClassCard({super.key, required this.gymClass, this.onReservar});

  @override
  Widget build(BuildContext context) {
    final llena = gymClass.estaLlena;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          // Bloque de hora
          Container(
            width: 56,
            padding: const EdgeInsets.symmetric(vertical: 10),
            decoration: BoxDecoration(
              color: AppColors.surfaceVariant,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Column(
              children: [
                Text(
                  gymClass.horaInicio,
                  style: const TextStyle(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w800,
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 14),
          // Info de la clase
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(gymClass.nombre, style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 4),
                Text(
                  'Entrenador: ${gymClass.entrenador}',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 4),
                Text(
                  llena
                      ? 'Sin cupos disponibles'
                      : '${gymClass.cuposDisponibles} cupos disponibles',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: llena ? AppColors.danger : AppColors.success,
                  ),
                ),
              ],
            ),
          ),
          // Botón reservar
          ElevatedButton(
            onPressed: llena ? null : onReservar,
            style: ElevatedButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            ),
            child: Text(llena ? 'LLENA' : 'RESERVAR'),
          ),
        ],
      ),
    );
  }
}
