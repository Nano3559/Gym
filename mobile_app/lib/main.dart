import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'theme/app_theme.dart';
import 'screens/home_screen.dart';
import 'screens/plans_screen.dart';
import 'screens/schedule_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Carga las variables desde el archivo .env (ver instrucciones abajo)
  await dotenv.load(fileName: '.env');

  await Supabase.initialize(
    url: dotenv.env['SUPABASE_URL']!,
    anonKey: dotenv.env['SUPABASE_ANON_KEY']!,
  );

  runApp(const IronForgeApp());
}

class IronForgeApp extends StatelessWidget {
  const IronForgeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'IronForge Gym',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,
      home: const RootShell(),
    );
  }
}

/// Contenedor con la barra de navegación inferior que cambia
/// entre Home, Planes y Horarios.
class RootShell extends StatefulWidget {
  const RootShell({super.key});

  @override
  State<RootShell> createState() => _RootShellState();
}

class _RootShellState extends State<RootShell> {
  int _indiceActual = 0;

  void _irA(int index) {
    setState(() => _indiceActual = index);
  }

  @override
  Widget build(BuildContext context) {
    final pantallas = [
      HomeScreen(
        onVerPlanes: () => _irA(1),
        onVerHorarios: () => _irA(2),
      ),
      const PlansScreen(),
      const ScheduleScreen(),
    ];

    return Scaffold(
      body: IndexedStack(index: _indiceActual, children: pantallas),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _indiceActual,
        onTap: _irA,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home_outlined), label: 'Home'),
          BottomNavigationBarItem(
            icon: Icon(Icons.card_membership_outlined),
            label: 'Planes',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.calendar_today_outlined),
            label: 'Horarios',
          ),
        ],
      ),
    );
  }
}
