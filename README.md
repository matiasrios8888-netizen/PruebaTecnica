# Permisos – Bprosys

Aplicación web de **solicitud y aprobación de permisos** de los colaboradores de una empresa. Cada trámite sigue el flujo **Solicitar → Aprobar → Gestionar RH**, con control por rol, adjuntos, notas y trazabilidad completa (quién hizo qué y cuándo).

Prueba técnica para Bprosys.

- **Deploy:** _pendiente (Fase 6, Vercel)_
- **Stack:** HTML, CSS y JavaScript vanilla (ES modules, sin bundler) · Firebase Authentication · Cloud Firestore · Vercel

## Estado

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Base: estructura, Firebase, login, modelo de datos, datos de prueba, reglas de seguridad | ✅ |
| 2 | Flujo completo de una solicitud con historial | ✅ |
| 3 | Bandeja (pendientes / enviadas / nuevas, filtros, orden, búsqueda) y control de campos por rol | ✅ |
| 4 | Mantenimiento de usuarios y roles | ✅ |
| 5 | Reportes de gestión | ⏳ |
| 6 | Diseño final, pruebas por rol, deploy y documentación | ⏳ |

## Qué se puede hacer hoy

- **Iniciador:** crear solicitudes (6 tipos de permiso, con días máximos y adjunto obligatorio según el tipo), adjuntar archivos, agregar notas, cancelar mientras no fue aprobada y corregir y reenviar una solicitud devuelta.
- **Supervisor:** aprobar, devolver (con motivo obligatorio) o rechazar las solicitudes de su equipo.
- **RH:** completar la gestión de las solicitudes aprobadas cargando la referencia de liquidación y los días descontados, o rechazarla (asignadas por reparto rotativo). Ve todas las solicitudes de la empresa.
- **Admin:** ve todas las solicitudes de la empresa y gestiona usuarios y roles (ver abajo).
- **Todos:** una **bandeja** con pestañas *Pendientes*, *Nuevas* (sin abrir) y *Enviadas* (y *Todas* para RH y admin), con contadores, búsqueda (sin tildes ni mayúsculas), filtros por estado, etapa, tipo y rango de fechas, y orden. En el detalle ven la etapa, los adjuntos y el historial completo.
- **Control de campos por rol:** cada campo del trámite es editable, de solo lectura u oculto según el rol, el estado y si el usuario es el asignado (`MATRIZ_CAMPOS`). Las reglas de Firestore exigen lo mismo para la edición.
- **Mantenimiento (admin):**
  - **Usuarios:** listado con búsqueda y filtros. **Alta** con contraseña inicial: la cuenta se crea en una segunda instancia de Firebase, así el admin no pierde su sesión. **Ficha** para editar nombre, rol, área y supervisor, dar de **baja** (lógica) o **reactivar**, y enviar el mail de cambio de contraseña.
  - **Bloqueos:** la baja y el cambio de rol se bloquean, con los motivos a la vista, mientras el usuario participe en trámites abiertos, sea supervisor de colaboradores activos, sea el último RH activo o sea el propio admin.
  - **Roles:** los 4 roles del sistema con sus permisos (solo lectura). Se editan el nombre visible (que se ve en toda la app) y la descripción. "Crear rol" solo vuelve a crear uno de los 4 si falta en la base.

## Arquitectura

```
 Pantallas (src/ui)  ──▶  Servicios (src/services)  ──▶  Repositorios (src/data)  ──▶  Firebase
   muestran y            reglas de negocio:              solo leen y escriben
   capturan datos        permisos por rol,
                         transiciones, historial
                                     ▲                          ▲
                           src/config/constantes.js    src/config/firebase.js

 firestore.rules → seguridad por rol en el servidor (no se puede saltear desde el navegador)
```

```
index.html                  Página única (SPA con router por hash)
src/
  main.js                   Punto de entrada: observa la sesión y resuelve la ruta
  config/
    firebase.js             Inicialización y único punto de contacto con el CDN de Firebase
    constantes.js           Roles, etapas, estados, transiciones, tipos de permiso, límites
  data/                     Repositorios (Auth, cuentas de otros usuarios, usuarios, roles, solicitudes) y @typedef del modelo
  services/
    flujoSolicitud.js       Lógica PURA del flujo (acciones por rol, transiciones, validaciones)
    bandeja.js              Lógica PURA de la bandeja (pestañas, filtros, orden, búsqueda)
    gestionUsuarios.js      Lógica PURA del mantenimiento de usuarios (validaciones, bloqueos, filtros)
    gestionRoles.js         Lógica PURA de la gestión de roles (catálogo, roles faltantes)
    solicitudesServicio.js  Casos de uso: bandeja, crear, detalle, acciones, notas, adjuntos
    usuariosServicio.js     Casos de uso del mantenimiento: listar, alta, edición, baja, reactivación
    rolesServicio.js        Casos de uso de la gestión de roles
    catalogoRoles.js        Nombres de los roles en memoria (los elige el admin)
    authServicio.js         Sesión y perfil del usuario
  ui/                       Router, componentes (marco, tabla, formulario de usuario), pantallas (login, bandeja,
                            nueva solicitud, detalle, usuarios, alta, ficha, roles) y utilidades
  styles/main.css
firestore.rules             Reglas de seguridad
firestore.indexes.json      Índices compuestos (bandeja: asignadoA y participantes + fecha)
scripts/                    Herramientas de Node (no se publican): datos de prueba y tests (lógica + reglas)
docs/MODELO_DATOS.md        Colecciones, campos, tipos y ejemplos
DECISIONES.md               Decisiones técnicas con alternativas y justificación
BITACORA.md                 Registro paso a paso de la construcción
BUGS.md                     Registro de bugs y observaciones (se resuelven antes de cada fase)
```

El modelo de datos está documentado en [docs/MODELO_DATOS.md](docs/MODELO_DATOS.md) y las decisiones técnicas en [DECISIONES.md](DECISIONES.md).

## Usuarios de prueba

Contraseña común: **`Bprosys2026!`**

| Rol | Email | Nombre |
|---|---|---|
| Iniciador | `iniciador@bprosys.test` | Ana Gómez |
| Supervisor | `supervisor@bprosys.test` | Carlos Pérez |
| Recursos Humanos | `rh@bprosys.test` | Laura Fernández |
| Administrador | `admin@bprosys.test` | Martín Sosa |
| Supervisor (sin equipo activo) | `sofia.diaz@bprosys.test` | Sofía Díaz |
| Iniciador **dado de baja** | `pedro.ruiz@bprosys.test` | Pedro Ruiz |

Son cuentas de demostración, creadas por el script de datos de prueba. Sofía y Pedro sirven para probar el mantenimiento: Sofía se puede dar de baja (no tiene trámites ni colaboradores activos) y Pedro no puede iniciar sesión hasta que el admin lo reactive.

## Correr en local

Los ES modules no funcionan abriendo el HTML con doble clic (`file://`), así que hace falta un servidor HTTP local.

**Opción A – VS Code + Live Server** (recomendada; VS Code sugiere la extensión al abrir el proyecto):
1. Instalar la extensión **Live Server** (`ritwickdey.LiveServer`).
2. Clic derecho en `index.html` → **Open with Live Server**.
3. Se abre `http://127.0.0.1:5500`.

**Opción B – terminal:**
```bash
npx serve .
```
y abrir `http://localhost:3000`.

`localhost` ya es un dominio autorizado en Firebase Authentication.

## Scripts (carpeta `scripts/`)

Requieren Node 20+. Los tests requieren además Java 21+ y Firebase CLI (`npm install -g firebase-tools`).

```bash
cd scripts
npm install
```

| Comando | Qué hace |
|---|---|
| `npm run seed:simular` | Valida los datos de prueba y la conexión **sin escribir nada**. |
| `npm run seed` | Crea o actualiza los 6 usuarios de prueba, los 4 roles y 10 solicitudes con historial y adjuntos. Es idempotente. No cambia la contraseña de los usuarios que ya existen (así no cierra sus sesiones). |
| `npm run seed:restablecer-claves` | Igual que `seed`, pero además vuelve a poner la contraseña común a los usuarios existentes (cierra sus sesiones abiertas). |
| `npm test` | Corre todos los tests (unitarios + reglas). |
| `npm run test:unitarios` | Tests de la lógica pura: flujo, bandeja, mantenimiento de usuarios y gestión de roles. No necesita Firebase. |
| `npm run test:reglas` | Tests de `firestore.rules` contra el emulador de Firestore (no toca la base real). |

`seed` necesita la clave de cuenta de servicio en `scripts/serviceAccountKey.json`, que se descarga en la consola de Firebase: Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada. **Ese archivo es secreto y está en `.gitignore`.**

## Reglas de seguridad

Para publicar las reglas y los índices (requiere `firebase login`):
```bash
firebase deploy --only firestore:rules,firestore:indexes
```
Para validarlas sin publicar: `firebase deploy --only firestore:rules --dry-run`.
