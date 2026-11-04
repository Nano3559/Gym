# Perfil local de prueba para presentar el Hito 4

Abre esta carpeta en Visual Studio Code. En una terminal:

```powershell
cd "C:\Users\HP\Documents\Codex\Gym-ultima-version\frontend-web"
npm run demo
```

Se abrirá la dirección local con `?demo=hito4`; normalmente `http://127.0.0.1:5173/?demo=hito4`. Usa el puerto indicado por la terminal si 5173 está ocupado.

No necesitas correo, contraseña, migraciones ni una conexión operativa a Supabase para esta demostración.

## Perfil precargado

- Lucía Demo, nacida el 1 de enero de 1995.
- Estatura: 165 cm. Parámetro femenino para la fórmula.
- Peso inicial: 82 kg. Último peso ficticio: 79,51 kg.
- Meta: 79 kg. Zona horaria: America/La_Paz.
- 84 días ficticios de pesajes, comidas y actividad, fechados respecto del día de apertura.

## Qué mostrar

1. Perfil, meta y pesajes.
2. Diario del último día cerrado.
3. Balance y cobertura de 28 días.
4. Gráfico de peso observado y tendencia, con tabla accesible.
5. Proyección explicable a siete días y escenario de meta cuando corresponde.
6. Corrige las calorías de la última comida: la cobertura bajará porque el día vuelve a estar incompleto. Confirma nuevamente la alimentación para recalcular.
7. Corrige el último pesaje o la meta y observa los controles del cálculo.

Utiliza «Restablecer datos de prueba» para empezar otra vez. Recargar la página también restablece todo.

La demostración usa las funciones reales de gasto, balance, tendencia y proyección, con registros generados artificialmente. No prueba precisión del modelo, persistencia remota ni permisos RLS. No es una cuenta de Supabase y no concede acceso de cliente o administrador.

Los cambios permanecen exclusivamente en memoria; no se escriben en localStorage ni en la nube. El acceso solo existe al ejecutar el servidor de desarrollo. Una compilación de producción ignora el parámetro de demostración.

Para abrir la aplicación normal usa «Volver a la aplicación» o quita `?demo=hito4` de la dirección. Esa aplicación conserva su autenticación y persistencia habituales y sigue necesitando Supabase.

Pruebas: `npm run test:demo`. La presentación local no requiere ejecutar de nuevo el experimento DIETFITS.
