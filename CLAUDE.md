# CLAUDE.md – Reglas del proyecto

Prueba técnica para **Bprosys**: aplicación de solicitud y aprobación de permisos de colaboradores.
El desarrollador es junior y necesita **entender** todo lo que se construye (después lo explica en un video y un programador puede revisar el código). Estas reglas valen para todas las sesiones.

---

## Cómo trabajamos

### Explicación y ritmo
- Antes de escribir código, explicar en palabras simples qué se va a hacer y por qué.
- Trabajar en pasos chicos. Al terminar cada paso, frenar y explicar cómo probarlo.
- Cuando aparezca un concepto nuevo (capas, reglas de seguridad, consultas, índices, etc.), explicarlo con un ejemplo de este proyecto.
- No avanzar a la siguiente fase sin aprobación explícita.

### Comentarios en el código (pensados para quien revise el código)
- Comentarios en español, claros y profesionales.
- Al inicio de cada archivo: un bloque que diga qué capa es, qué responsabilidad tiene y de qué otros archivos depende.
- Cada función importante con JSDoc: qué hace, parámetros (`@param`), qué devuelve (`@returns`) y errores posibles (`@throws`).
- Marcar las partes críticas con comentarios destacados:
  - `// ⚠️ IMPORTANTE: ...` → reglas de negocio, validaciones de rol, transiciones de estado.
  - `// 🔒 SEGURIDAD: ...` → permisos, reglas de Firestore.
  - `// 📝 TRAZABILIDAD: ...` → dónde se registra el historial.
- No comentar lo obvio. Comentar el "por qué", no el "qué hace cada línea".

### Datos bien ordenados
- Cada entidad (usuario, rol, tipo de permiso, solicitud, historial, adjunto) se define con un `@typedef` de JSDoc y un ejemplo en JSON.
- Mantener `docs/MODELO_DATOS.md` con cada colección de Firestore, sus campos, tipos y un JSON de ejemplo.
- Nombres de campos consistentes en **camelCase y en español** (ej: `fechaInicio`, `estadoActual`, `asignadoA`).
- Constantes centralizadas (roles, estados, etapas, tipos de permiso, transiciones, límites) en `src/config/constantes.js`. No repetir textos sueltos por el código.

### Git y GitHub
- El proyecto vive en un repositorio de GitHub. Commits chicos y frecuentes, push seguido y una rama por funcionalidad.
- Estrategia de ramas:
  - `main`: siempre estable y funcionando.
  - Una rama por fase o funcionalidad: `feature/fase-1-base`, `feature/bandeja`, `feature/flujo-aprobacion`, `feature/mantenimiento`, `feature/reportes`, `fix/...` para correcciones.
- Al terminar cada paso que funcione: proponer el mensaje de commit y los comandos de git, explicar qué hace cada comando y **ejecutarlos solo con aprobación**.
- Mensajes de commit en español con prefijo convencional: `feat:`, `fix:`, `docs:`, `refactor:`, `style:`, `chore:`. Ejemplo: `feat: login con email y contraseña`.
- Al terminar una fase: merge de la rama a `main` (explicando cómo) y push.
- `.gitignore` desde el principio. **NUNCA** subir claves privadas (por ejemplo, la clave de cuenta de servicio de Firebase del script de datos de prueba). Si algo no debe subirse, avisar.

### Documentación de decisiones
- Cada decisión técnica importante va a `DECISIONES.md` con: qué decidimos, alternativas consideradas y por qué.
- Al final de cada fase, resumir lo hecho como si se le explicara a un entrevistador.
- Mantener `README.md` con: descripción, arquitectura, cómo correrlo en local, usuarios de prueba y link al deploy.

### Bitácora del proyecto (BITACORA.md)
- `BITACORA.md` vive en la raíz y se actualiza al terminar **CADA** paso, sin que haga falta pedirlo.
- Cada entrada con este formato:
  ```
  ## [Fecha] – Fase X – Paso: título corto
  - Qué hicimos: explicación simple de lo que se construyó.
  - Archivos creados o modificados: lista con una línea sobre qué hace cada uno.
  - Conceptos aprendidos: términos nuevos explicados en 1-2 líneas.
  - Comandos usados: comandos de git o terminal y qué hace cada uno.
  - Cómo probarlo: pasos para verificar que funciona.
  - Pendientes o dudas: lo que quedó para después.
  ```
- Al final de cada fase, un "Resumen de la fase" de 5-6 líneas, como para un entrevistador.
- `BITACORA.md` = paso a paso; `DECISIONES.md` = solo decisiones técnicas importantes. No duplicar.
- `BITACORA.md` se incluye en los commits junto con los cambios que describe.

---

## Stack y arquitectura
- HTML, CSS y JavaScript vanilla con ES modules, **sin bundler**: el SDK modular de Firebase se importa desde el CDN oficial (`https://www.gstatic.com/firebasejs/<versión>/...`), así la app se publica como sitio estático.
- Firebase Authentication (email y contraseña) y Firestore. Deploy en Vercel.
- Arquitectura en capas:
  - `src/ui/` → pantallas y componentes. **No acceden directo a Firestore.**
  - `src/services/` → lógica de negocio: permisos por rol, transiciones de estado, registro del historial.
  - `src/data/` → repositorios que leen y escriben en Firestore.
  - `src/config/` → configuración de Firebase y constantes.
  - `firestore.rules` → seguridad por rol en el servidor.
- Script de datos de prueba en `scripts/` (Node + `firebase-admin`), con la clave de cuenta de servicio en `scripts/serviceAccountKey.json` (ignorada por git).

## Decisiones ya tomadas (detalle en DECISIONES.md)
- Adjuntos guardados en Firestore como base64 (plan Spark, sin Storage), máximo **600 KB por archivo**, validado en el servicio y en las reglas.
- Historial de cada solicitud append-only (`solicitudes/{id}/historial`); las notas son eventos del historial.
- Alta de usuarios desde la app (Fase 4) con una **segunda instancia de Firebase App** para no cerrar la sesión del admin; baja lógica (`activo: false`).

## Enunciado de la prueba
Construir una app de solicitud y aprobación de permisos de los colaboradores de una empresa. Entregables:
1. **Portal de tareas:** login con usuario y contraseña; bandeja con tareas pendientes, enviadas y nuevas; filtrar, ordenar y buscar dentro de la bandeja.
2. **Aplicación:** flujo Solicitar → Aprobar → Gestionar RH; control de campos según el rol del usuario (iniciador, supervisor, RH); diferentes tipos de permisos; adjuntar archivos y agregar notas al trámite; trazabilidad completa del trámite (quién hizo qué y cuándo).
3. **Mantenimiento:** gestión de usuarios (alta, edición, baja) y gestión de roles.
4. **Reportes de gestión:** distribución de trámites por etapa y carga de tareas pendientes por usuario.
Arquitectura en capas.

## Plan por fases
- **Fase 1:** base (estructura, Firebase, login, modelo de datos, datos de prueba, reglas de seguridad).
- **Fase 2:** flujo completo de una solicitud con historial.
- **Fase 3:** bandeja (pendientes / enviadas / nuevas, filtros, orden, búsqueda) y control de campos por rol.
- **Fase 4:** mantenimiento de usuarios y roles.
- **Fase 5:** reportes.
- **Fase 6:** diseño final, pruebas con cada rol, deploy en Vercel y documentación.
