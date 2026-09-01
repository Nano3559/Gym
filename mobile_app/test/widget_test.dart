// Test básico de que la app arranca correctamente.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile_app/main.dart';

void main() {
  testWidgets('La app carga y muestra la pantalla Home', (WidgetTester tester) async {
    await tester.pumpWidget(const IronForgeApp());

    // Verifica que la barra de navegación inferior tenga las 3 secciones.
    expect(find.text('Home'), findsOneWidget);
    expect(find.text('Planes'), findsOneWidget);
    expect(find.text('Horarios'), findsOneWidget);
  });
}