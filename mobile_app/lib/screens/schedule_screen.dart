import 'package:flutter/material.dart';
import '../models/gym_class.dart';
import '../services/supabase_service.dart';
import '../theme/app_theme.dart';
import '../widgets/class_card.dart';

class ScheduleScreen extends StatefulWidget {
  const ScheduleScreen({super.key});

  @override
  State<ScheduleScreen> createState() => _ScheduleScreenState();
}

class _ScheduleScreenState extends State<ScheduleScreen> {
  late DateTime _fechaSeleccionada;
  late Future<List<GymClass>> _clasesFuture;
  late List<DateTime> _diasSemana;

  @override
  void initState() {
    super.initState();
    final hoy = DateTime.now();
    // Empezamos la semana en lunes
    final inicioSemana = hoy.subtract(Duration(days: hoy.weekday - 1));
    _diasSemana = List.generate(6, (i) => inicioSemana.add(Duration(days: i)));
    _fechaSeleccionada = hoy;
    _clasesFuture = SupabaseService.getClasesPorFecha(_fechaSeleccionada);
  }

  void _seleccionarDia(DateTime dia) {
    setState(() {
      _fechaSeleccionada = dia;
      _clasesFuture = SupabaseService.getClasesPorFecha(dia);
    });
  }

  static const _nombresDias = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
            child: Text('Horarios', style: Theme.of(context).textTheme.displayLarge),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Text(
              'Consulta y elige tu clase',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
          const SizedBox(height: 20),

          // Selector de días de la semana
          SizedBox(
            height: 72,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 20),
              itemCount: _diasSemana.length,
              separatorBuilder: (_, __) => const SizedBox(width: 10),
              itemBuilder: (context, index) {
                final dia = _diasSemana[index];
                final seleccionado = _mismodia(dia, _fechaSeleccionada);
                return GestureDetector(
                  onTap: () => _seleccionarDia(dia),
                  child: Container(
                    width: 56,
                    decoration: BoxDecoration(
                      color: seleccionado ? AppColors.primary : AppColors.surface,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: seleccionado ? AppColors.primary : AppColors.border,
                      ),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          _nombresDias[index],
                          style: TextStyle(
                            fontSize: 12,
                            color: seleccionado ? Colors.white70 : AppColors.textMuted,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${dia.day}',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: seleccionado ? Colors.white : AppColors.textPrimary,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 20),

          // Lista de clases del día
          Expanded(
            child: FutureBuilder<List<GymClass>>(
              future: _clasesFuture,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(
                    child: CircularProgressIndicator(color: AppColors.primary),
                  );
                }

                if (snapshot.hasError) {
                  return Center(
                    child: Text(
                      'No se pudieron cargar las clases.\n${snapshot.error}',
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: AppColors.textSecondary),
                    ),
                  );
                }

                final clases = snapshot.data ?? [];
                if (clases.isEmpty) {
                  return const Center(
                    child: Text(
                      'No hay clases programadas este día',
                      style: TextStyle(color: AppColors.textSecondary),
                    ),
                  );
                }

                return ListView.builder(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                  itemCount: clases.length,
                  itemBuilder: (context, index) {
                    final clase = clases[index];
                    return ClassCard(
                      gymClass: clase,
                      onReservar: () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('Reservaste: ${clase.nombre}')),
                        );
                      },
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  bool _mismodia(DateTime a, DateTime b) {
    return a.year == b.year && a.month == b.month && a.day == b.day;
  }
}
