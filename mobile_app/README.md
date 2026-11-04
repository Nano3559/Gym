# IronForge Gym — Aplicación Móvil (Flutter)

Aplicación móvil oficial para socios del gimnasio IronForge, desarrollada con **Flutter** y conectada a **Supabase** (Auth, PostgreSQL y Realtime).

---

## 🚀 Funcionalidades

1. **Autenticación:** Inicio de sesión y registro de socios sincronizado con Supabase Auth y perfiles de usuario.
2. **Dashboard del Socio (Home):** Accesos directos, bienvenida personalizada y estado de membresía.
3. **Planes de Membresía:** Catálogo de membresías activas (Básico, Completo, Premium) en Bolivianos (Bs.).
4. **Matriz de Horarios:** Consulta de clases con filtrado por día, cupos disponibles en tiempo real y reserva de clases.
5. **Mis Reservas:** Historial de clases apartadas con opción de cancelación instantánea.
6. **Pase Digital QR:** Generación de código QR con los datos del socio para validación rápida en recepción.
7. **Escáner QR (Recepción):** Herramienta con cámara para validar el acceso de socios escaneando su pase digital.

---

## 🛠️ Configuración y Ejecución

### 1. Variables de entorno

Copia el archivo `.env.example` como `.env` dentro de esta carpeta (`mobile_app/`):

```bash
cp .env.example .env
```

Edita `.env` con las credenciales de tu proyecto Supabase:

```env
SUPABASE_URL=https://TU_PROYECTO.supabase.co
SUPABASE_ANON_KEY=TU_CLAVE_ANON_PUBLISHABLE
```

### 2. Instalar dependencias

```bash
flutter pub get
```

### 3. Iniciar la aplicación

Para ejecutar en emulador o dispositivo físico:

```bash
flutter run
```
