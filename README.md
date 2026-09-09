# IronForge Gym — Sistema de Gestión y Portal de Reservas

Aplicación web completa para la gestión integral de un gimnasio y portal interactivo para socios, desarrollada como solución al pliego de 15 requerimientos del sistema de gimnasio.

---

## 🛠️ Stack Tecnológico & Arquitectura

- **Frontend Web:** React (Vite) + Tailwind CSS
- **Base de Datos & Auth:** Supabase (PostgreSQL, Row Level Security, Realtime)
- **Gestión de Estado & Iconos:** Lucide React / React Context API
- **Despliegue Web:** Netlify
- **Aplicación Móvil:** Flutter (Dart) para Android / iOS

---

## 🚀 Requerimientos y Funcionalidades Implementadas

### Portal Público & Cliente

1. **Página Principal (Hero):** Banner con slogan, botones de acción rápida (*Inscribirme*, *Ver planes*) y navegación fluida.
2. **Sección de Servicios:** Catálogo con imágenes, descripciones y horarios para Musculación, CrossFit, Yoga, Zumba, Funcional, Spinning, etc.
3. **Planes de Membresía:** Comparativa de tarifas (Básico, Completo, Premium) en Bolivianos (Bs.).
4. **Registro de Clientes:** Formulario validado para captura de datos personales, CI, contacto de emergencia y plan inicial.
5. **Matriz de Horarios:** Vista semanal interactiva de clases con capacidad máxima y contador de cupos disponibles en tiempo real.
6. **Sistema de Reservas:** Flujo de reserva con validación de sesión y vista "Mis Reservas" con opción de cancelación.
7. **Perfil de Entrenadores:** Galería con especialidades, experiencia y horarios asignados.
8. **Contacto:** Formulario de mensajes, datos de ubicación, WhatsApp y redes sociales.

### Panel Administrativo (Admin Dashboard)

9. **Dashboard General:** Métricas clave en tiempo real (clientes activos, membresías por vencer, ingresos del mes, clases del día).
10. **Gestión de Clientes (CRUD):** Registro, edición, baja y control de estado de membresías (Activa, Por Vencer, Vencida).
11. **Gestión de Membresías y Planes:** Creación y modificación de precios, duración y estado activo/inactivo de planes.
12. **Control de Asistencia:** Buscador por CI o nombre para registro de ingreso rápido en recepción.
13. **Registro de Pagos:** Módulo de cobros que soporta QR, Efectivo, Transferencia y Tarjeta.
14. **Reportes y Analíticas:** Filtros por fecha y tipo de reporte (ingresos, asistencias, clases más concurridas).
15. **Seguridad y Roles:** Autenticación con Supabase, control de acceso por roles (Cliente, Recepción, Admin) y manejo seguro de sesiones mediante modales.

---

## 💻 Instalación y Configuración Local

### 1. Requisitos Previos

- **Node.js** (v18 o superior)
- **Flutter SDK** (v3.13 o superior) y Android Studio / dispositivo
- Cuenta activa en **Supabase**

### 2. Clonar el Repositorio

```bash
git clone https://github.com/Nano3559/Gym.git
cd Gym
```

### 3. Ejecución del Frontend Web

```bash
cd frontend-web
npm install

# Configurar variables de entorno (copiar plantilla)
cp .env.example .env
# Editar .env con tus claves VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY

# Iniciar servidor de desarrollo
npm run dev
```
La aplicación web estará disponible en `http://localhost:5173`.

### 4. Ejecución de la App Móvil (Flutter)

```bash
cd ../mobile_app
flutter pub get

# Configurar variables de entorno (copiar plantilla)
cp .env.example .env
# Editar .env con SUPABASE_URL y SUPABASE_ANON_KEY

# Iniciar aplicación en emulador o dispositivo físico
flutter run
```