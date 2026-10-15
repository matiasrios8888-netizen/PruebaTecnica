# Bitácora del proyecto

Registro paso a paso de lo que se construyó. Las decisiones técnicas importantes están en `DECISIONES.md`.

---

## 2026-10-14 – Fase 1 – Paso: reglas del proyecto y repositorio

- **Qué hicimos:** dejamos escritas las reglas de trabajo del proyecto, ignoramos los archivos que no deben subirse, inicializamos git y conectamos el repositorio de GitHub. Creamos la rama `feature/fase-1-base`, donde se va a construir toda la Fase 1.
- **Archivos creados o modificados:**
  - `CLAUDE.md`: reglas de trabajo (ritmo, comentarios, datos, git, documentación, bitácora), stack, arquitectura, enunciado y plan por fases. Claude Code lo lee al empezar cada sesión.
  - `.gitignore`: lista de archivos que git no debe seguir (clave privada de Firebase, `node_modules`, logs, `.env`).
  - `BITACORA.md`: este archivo, el registro paso a paso.
- **Conceptos aprendidos:**
  - **Repositorio git:** carpeta cuyo historial de cambios guarda git. Cada *commit* es una "foto" del proyecto con un mensaje que explica qué cambió.
  - **Rama (branch):** línea de trabajo paralela. `main` siempre funciona; las funcionalidades nuevas se hacen en ramas `feature/...` y se unen a `main` (merge) cuando están terminadas.
  - **Remoto (`origin`):** la copia del repositorio en GitHub. `push` sube los commits; `pull` baja los cambios.
  - **`.gitignore`:** evita subir por error secretos (como la clave de cuenta de servicio de Firebase, que da acceso total a la base) o archivos que se pueden regenerar.
- **Comandos usados:**
  - `git init -b main`: crea el repositorio local con la rama principal llamada `main`.
  - `git add CLAUDE.md BITACORA.md .gitignore`: prepara (*stage*) esos archivos para el próximo commit.
  - `git commit -m "chore: reglas del proyecto, bitácora y .gitignore"`: guarda la foto con su mensaje. `chore:` indica una tarea de mantenimiento o configuración, no una funcionalidad.
  - `git remote add origin <url>`: le dice al repo local dónde está la copia en GitHub.
  - `git push -u origin main`: sube `main` a GitHub; `-u` recuerda la conexión para que después alcance con `git push`.
  - `git switch -c feature/fase-1-base`: crea la rama de la fase y se mueve a ella.
  - `git push -u origin feature/fase-1-base`: publica la rama nueva en GitHub.
- **Cómo probarlo:**
  - `git status` → dice `On branch feature/fase-1-base` y no hay nada pendiente.
  - `git log --oneline` → aparece el primer commit.
  - En GitHub se ven los 3 archivos en `main` y la rama `feature/fase-1-base`.
- **Pendientes o dudas:** en el Paso 2 se presenta la arquitectura y el modelo de datos para aprobarlos antes de escribir código.

---

## 2026-10-14 – Fase 1 – Paso: estructura base, configuración de Firebase y modelo de datos

- **Qué hicimos:** aprobamos la arquitectura en capas y el modelo de datos (Paso 2). Creamos la estructura de carpetas, conectamos la app con Firebase usando el SDK desde el CDN y centralizamos todas las constantes del dominio en un solo archivo. Documentamos cada entidad con `@typedef` y cada colección en `docs/MODELO_DATOS.md`.
- **Archivos creados o modificados:**
  - `index.html`: página única de la app; carga `src/main.js` como ES module.
  - `src/main.js`: punto de entrada. Por ahora solo muestra que Firebase se inicializó; en el próximo paso maneja el login.
  - `src/config/firebase.js`: inicializa Firebase, exporta `auth` y `db` y reexporta las funciones del SDK. Es el único archivo con la URL y la versión del CDN (12.19.0).
  - `src/config/constantes.js`: roles, etapas, estados, tabla de transiciones, tipos de permiso, acciones del historial, límites de adjuntos y nombres de colecciones.
  - `src/data/modelos.js`: `@typedef` de Usuario, Rol, TipoPermiso, Solicitud, EventoHistorial y Adjunto, con un JSON de ejemplo cada uno.
  - `docs/MODELO_DATOS.md`: cada colección con sus campos, tipos, ejemplo y el flujo de estados.
  - `.vscode/extensions.json`: recomienda la extensión Live Server para levantar la app.
  - `.gitignore`: se agregó `.playwright-mcp/` (archivos temporales de las pruebas con navegador).
- **Conceptos aprendidos:**
  - **ES modules:** `import`/`export` nativos del navegador. Con `<script type="module">` el navegador descarga cada archivo importado, sin bundler. Necesitan un servidor HTTP: abriendo el HTML con doble clic (`file://`) no funcionan.
  - **CDN:** servidor público que entrega archivos (acá, el SDK de Firebase desde `gstatic.com`). Se fija una versión exacta para que la app no cambie sola.
  - **Reexportar:** `export { doc } from '...'` deja que otros archivos importen `doc` desde `firebase.js`. Así la versión del SDK se cambia en un solo lugar.
  - **Desnormalizar:** copiar datos (como el nombre del solicitante) dentro de otro documento para no hacer lecturas extra, porque Firestore no tiene JOIN.
  - **Etapa vs. estado:** la etapa es en qué parte del proceso está el trámite; el estado es qué pasó exactamente. Por ejemplo, "rechazada" y "completada" están las dos en la etapa "finalizada".
  - **`Object.freeze`:** impide modificar un objeto de constantes por error en tiempo de ejecución.
- **Comandos usados:**
  - `gh auth login` y `gh auth setup-git`: iniciar sesión en GitHub y hacer que git use esas credenciales. Se corrigió una configuración global vieja que apuntaba a un `gh.exe` inexistente.
  - `git push -u origin main` y `git push -u origin feature/fase-1-base`: publicar las dos ramas en GitHub.
  - `npx serve -l 5599 .`: levantar un servidor estático temporal para probar la página.
- **Cómo probarlo:**
  1. En VS Code, clic derecho en `index.html` → **Open with Live Server** (o `npx serve .` en la terminal).
  2. La página muestra `Firebase inicializado ✔ – proyecto: pruebatecnica-2002c`.
  3. En la consola del navegador (F12) aparece `[main] Firebase inicializado pruebatecnica-2002c`, sin errores.
- **Pendientes o dudas:** se eligió la versión 12.19.0 del SDK en lugar de la 13.0.0 (ver DECISIONES.md, que se crea en el sub-paso de documentación). Próximo paso: login.

---

## 2026-10-14 – Fase 1 – Paso: login con email y contraseña

- **Qué hicimos:** construimos el login atravesando las tres capas: la pantalla captura los datos, el servicio aplica las reglas (perfil existente y usuario activo) y traduce los errores, y los repositorios hablan con Firebase Auth y Firestore. Agregamos un router por hash que protege las pantallas privadas y una pantalla de inicio provisoria con el nombre y el rol.
- **Archivos creados o modificados:**
  - `src/data/authRepositorio.js`: envuelve las llamadas a Firebase Auth (autenticar, desautenticar, escuchar la sesión).
  - `src/data/usuariosRepositorio.js`: `obtenerUsuarioPorId(uid)` lee el perfil en `usuarios/{uid}`.
  - `src/services/authServicio.js`: iniciar y cerrar sesión, cargar el perfil, rechazar usuarios sin perfil o inactivos, mensajes de error en español.
  - `src/services/errores.js`: clase `ErrorAplicacion` (error con mensaje listo para mostrar).
  - `src/ui/router.js`: decide la pantalla según el hash (`#/login`, `#/inicio`) y redirige si no hay sesión.
  - `src/ui/pantallas/loginPantalla.js`: formulario de login.
  - `src/ui/pantallas/inicioPantalla.js`: bienvenida provisoria con nombre, rol, email, área y botón de cerrar sesión.
  - `src/ui/utils/html.js`: `escaparHtml()` para insertar datos de Firestore en el HTML sin riesgo de XSS.
  - `src/styles/main.css`: estilos base con variables CSS.
  - `src/main.js`: registra las rutas y reacciona a los cambios de sesión.
  - `index.html`: enlaza los estilos y un favicon vacío (evita un error 404 en consola).
- **Conceptos aprendidos:**
  - **Autenticación vs. autorización:** Firebase Auth confirma *quién sos* (email y contraseña). Qué podés hacer lo define tu perfil en Firestore (rol, activo) y lo hacen cumplir las reglas.
  - **`onAuthStateChanged`:** Firebase avisa cada vez que cambia la sesión, también al recargar la página, porque recuerda la sesión en el navegador.
  - **Router por hash / SPA:** cambiar lo que está después del `#` no recarga la página. Así una sola página HTML muestra distintas pantallas.
  - **XSS (Cross-Site Scripting):** si un dato con HTML se inserta sin escapar, el navegador lo ejecuta. Por eso los datos de Firestore pasan por `escaparHtml()` y los mensajes de error se ponen con `textContent`.
  - **Condición de carrera:** dos procesos que terminan en un orden inesperado. El cierre de sesión de un usuario inactivo redibujaba el login y borraba el mensaje de error; el router ahora no redibuja la pantalla que ya está mostrando.
- **Comandos usados:**
  - `git add .`, `git commit -m "..."` y `git push`: guardar y subir el sub-paso anterior.
  - `npx serve -l 5599 .`: servidor estático temporal para probar el login.
- **Cómo probarlo:**
  1. Levantá la app con Live Server. Sin sesión, la URL pasa sola a `#/login`.
  2. Tocá **Ingresar** con los campos vacíos → "Ingresá tu email y tu contraseña."
  3. Probá con un email y una contraseña inventados → "Email o contraseña incorrectos."
  4. El ingreso correcto se prueba después del script de datos de prueba y las reglas (próximos pasos).
- **Pendientes o dudas:** el login exitoso todavía no se puede probar: faltan los usuarios de prueba y las reglas que permiten leer el perfil.

---

## 2026-10-14 – Fase 1 – Paso: script de datos de prueba

- **Qué hicimos:** creamos un script de Node que carga en Firebase 4 usuarios de prueba (uno por rol), el catálogo de roles y 10 solicitudes en distintas etapas con historial y adjuntos. Cada solicitud está escrita como un "guion" de acciones, y el script lo recorre con la misma tabla `TRANSICIONES` que usa la app. Si un paso no está permitido, falla en lugar de cargar datos incoherentes.
- **Archivos creados o modificados:**
  - `scripts/package.json`: dependencia `firebase-admin` y los comandos `npm run seed` y `npm run seed:simular`.
  - `scripts/package-lock.json`: versiones exactas instaladas, para que la instalación sea reproducible.
  - `scripts/datosPrueba.mjs`: qué se carga (usuarios, descripción de roles, guiones de las 10 solicitudes).
  - `scripts/seed.mjs`: cómo se carga (crea o actualiza usuarios en Auth, escribe perfiles y roles, borra y recrea las solicitudes). Tiene un modo simulación que no escribe nada.
  - `.vercelignore`: excluye `scripts/` del sitio publicado.
- **Conceptos aprendidos:**
  - **firebase-admin (Admin SDK):** SDK para servidores. Se autentica con la clave de cuenta de servicio y saltea las reglas de seguridad. Por eso solo corre en la PC del desarrollador y la clave no se sube nunca.
  - **Idempotente:** se puede ejecutar varias veces y el resultado es siempre el mismo. Los usuarios existentes se actualizan y las solicitudes se recrean.
  - **`recursiveDelete`:** en Firestore, borrar un documento NO borra sus subcolecciones. Hay que borrarlas explícitamente para no dejar historial huérfano.
  - **Modo simulación (*dry run*):** valida todo y prueba la conexión solo con lecturas, antes de modificar datos reales.
  - **Datos guiados por reglas:** generar los datos aplicando la tabla de transiciones garantiza que el historial sea coherente con el estado final.
- **Comandos usados:**
  - `npm install` (en `scripts/`): descarga `firebase-admin` en `scripts/node_modules/`, que está ignorada por git.
  - `npm run seed:simular`: valida los guiones y la conexión sin escribir.
  - `npm run seed`: carga los datos en Firebase.
  - `git check-ignore -v scripts/serviceAccountKey.json`: confirma qué línea del `.gitignore` excluye la clave.
- **Cómo probarlo:**
  1. `cd scripts`, después `npm install` y después `npm run seed`.
  2. En la consola de Firebase: **Authentication** muestra 4 usuarios y **Firestore** las colecciones `usuarios` (4), `roles` (4) y `solicitudes` (10), cada solicitud con su subcolección `historial`.
  3. La tabla de resumen del script muestra: 3 en aprobación, 1 devuelta, 3 en gestión RH, 2 completadas y 1 rechazada.
- **Pendientes o dudas:**
  - El login con estos usuarios funciona recién cuando se publiquen las reglas de Firestore (próximo paso): en modo producción la base rechaza todas las lecturas.
  - Fase 2: definir cómo se genera el número correlativo (`SOL-0011`…) de las solicitudes nuevas.

---

## 2026-10-14 – Fase 1 – Paso: reglas de seguridad de Firestore

- **Qué hicimos:** escribimos `firestore.rules`, la seguridad que corre en los servidores de Google. Controla quién lee y escribe cada colección, qué transiciones de estado son válidas y quién las ejecuta, que el historial sea append-only y coherente con cada cambio de estado, y el límite de 600 KB de los adjuntos. Las probamos con 30 tests automáticos contra el emulador de Firestore. Los tests encontraron un error real (una condición invertida) que corregimos antes de publicar.
- **Archivos creados o modificados:**
  - `firestore.rules`: reglas por colección (usuarios, roles, solicitudes, historial, adjuntos).
  - `firebase.json`: le indica a Firebase CLI dónde están las reglas y los índices.
  - `.firebaserc`: proyecto por defecto (`pruebatecnica-2002c`) para los comandos de Firebase CLI.
  - `firestore.indexes.json`: índices compuestos (vacío por ahora; se completa en la Fase 3).
  - `scripts/tests/reglas.test.mjs`: 30 tests de las reglas (permitidos y rechazados) para cada rol.
  - `scripts/package.json` y `scripts/package-lock.json`: comando `npm run test:reglas` y dependencias de desarrollo `@firebase/rules-unit-testing` 5.0.2 y `firebase` 12.19.0.
- **Conceptos aprendidos:**
  - **Reglas de seguridad:** el código del navegador se puede modificar con F12; las reglas no, porque las evalúa el servidor. Si una regla da `false`, Firestore responde `permission-denied`.
  - **Las reglas no son filtros:** una consulta se rechaza entera si alguno de sus resultados posibles no cumple la regla. Por eso la bandeja va a consultar con `where('asignadoA', '==', uid)` o `where('participantes', 'array-contains', uid)`.
  - **`get()` / `getAfter()` / `exists()`:** desde una regla se pueden leer otros documentos. `get` ve el estado antes de la escritura y `getAfter` cómo queda después del lote. Con eso se verifica que el evento del historial coincide con el cambio real de la solicitud.
  - **`diff().affectedKeys()`:** devuelve qué campos cambian en una actualización. Se usa para prohibir cambiar `numero`, `solicitanteId`, `email`, etc.
  - **`request.time`:** la hora del servidor. Exigir `fecha == request.time` obliga a usar `serverTimestamp()`, así nadie puede falsear cuándo pasó algo.
  - **Emulador de Firestore:** una copia local de Firestore para probar sin tocar datos reales. Con el proyecto `demo-…` es imposible conectarse al proyecto real por error.
  - **Test que detecta un bug:** la condición de `vistaPorAsignado` estaba invertida y bloqueaba aprobar y devolver. Compilaba bien; solo un test lo podía detectar.
- **Comandos usados:**
  - `firebase login:list`: muestra con qué cuenta está logueado Firebase CLI.
  - `firebase deploy --only firestore:rules --dry-run`: compila y valida las reglas sin publicarlas.
  - `npm install --save-dev --save-exact @firebase/rules-unit-testing@5.0.2 firebase@12.19.0`: instala las librerías de testing con la versión exacta.
  - `npm run test:reglas`: levanta el emulador, corre los tests y lo apaga (`firebase emulators:exec`).
  - `firebase deploy --only firestore:rules,firestore:indexes`: publica las reglas y los índices en el proyecto real.
- **Cómo probarlo:**
  1. `cd scripts` y después `npm run test:reglas` → `pass 30`, `fail 0`.
  2. Con las reglas publicadas, levantá la app e ingresá con `iniciador@bprosys.test` / `Bprosys2026!` → la pantalla de inicio muestra "Hola, Ana Gómez" y el rol Iniciador. Repetí con los otros 3 usuarios.
  3. En la consola de Firebase → Firestore → **Reglas** se ve la versión publicada, y en **Rules Playground** se pueden simular lecturas y escrituras.
- **Pendientes o dudas:**
  - `npm audit` informa 5 vulnerabilidades altas en `@grpc/grpc-js`, que viene dentro de `firebase` (dependencia **solo de desarrollo** para los tests). Las dependencias del script de datos tienen 0. `npm audit fix --force` actualizaría a `firebase` 13 y rompería la compatibilidad; se revisa al actualizar el SDK.
  - Propuesta para la Fase 2: un campo `ultimoEventoId` en la solicitud para que las reglas exijan (con `existsAfter`) que **todo** cambio de estado venga con su evento de historial. Hoy se garantiza que cada evento es coherente con la solicitud, pero no lo inverso.

---

## 2026-10-14 – Fase 1 – Paso: decisiones técnicas y README

- **Qué hicimos:** publicamos las reglas en el proyecto real y probamos el login completo con los 4 usuarios. Documentamos las 17 decisiones técnicas de la fase y escribimos el README. Fijamos los finales de línea del repositorio.
- **Archivos creados o modificados:**
  - `DECISIONES.md`: cada decisión técnica con alternativas y justificación (capas, CDN, router por hash, rol en Firestore, desnormalización, historial append-only, adjuntos de 600 KB, alta de usuarios con segunda instancia de Firebase App, etc.).
  - `README.md`: descripción, estado por fases, arquitectura, usuarios de prueba, cómo correrlo, scripts y publicación de reglas.
  - `.gitattributes`: todos los archivos de texto con finales de línea LF.
  - `.vercelignore`: además de `scripts/`, excluye la configuración de Firebase CLI y los logs.
  - `CLAUDE.md`: se agregó la regla de correr los tests antes de publicar cambios en `firestore.rules`.
- **Conceptos aprendidos:**
  - **Finales de línea (LF / CRLF):** Windows termina cada línea con dos caracteres (CRLF) y Linux/macOS con uno (LF). `.gitattributes` fija uno solo para todo el equipo; por eso desaparecen los avisos `LF will be replaced by CRLF`.
  - **Registro de decisiones (ADR):** documentar el porqué de cada decisión permite defenderla en una revisión y no volver a discutirla.
- **Comandos usados:**
  - `firebase deploy --only firestore:rules,firestore:indexes`: publicó las reglas y los índices en `pruebatecnica-2002c`.
  - `npx serve -l 5599 .` + un navegador automatizado: login, recarga y cierre de sesión con los 4 usuarios.
- **Cómo probarlo:**
  1. Levantá la app con Live Server y entrá con cada usuario de la tabla del README → "Hola, {nombre}" con su rol.
  2. Recargá la página → seguís logueado. **Cerrar sesión** → volvés al login.
  3. Sin sesión, abrí `#/inicio` → te redirige a `#/login`.
- **Pendientes o dudas:** el link al deploy se completa en la Fase 6.

---

## Resumen de la Fase 1

Armamos la base de una app de permisos con arquitectura en capas (UI → servicios → repositorios → Firebase), en JavaScript vanilla y con el SDK de Firebase desde el CDN, para que se publique como sitio estático. Diseñamos el modelo de datos en Firestore pensando en las consultas: cada solicitud tiene etapa y estado, a quién está asignada y quiénes participaron, y un historial append-only en una subcolección. Las reglas del flujo viven en una tabla de transiciones centralizada que usan la app, el script de datos de prueba y, replicada, las reglas de seguridad. El login valida perfil y estado activo, y un script con firebase-admin carga 4 usuarios y 10 solicitudes con historial coherente. La seguridad se aplica en el servidor con `firestore.rules` (rol, transiciones válidas, historial firmado con la hora del servidor, adjuntos de hasta 600 KB) y está cubierta por 30 tests automáticos contra el emulador, que detectaron un error antes de publicar.

---

## 2026-10-15 – Fase 2 – Paso: contador, ultimoEventoId y reparto RH

- **Qué hicimos:** creamos la rama `feature/flujo-aprobacion` y ajustamos el modelo antes de construir el flujo:
  - un contador para numerar las solicitudes sin repetir;
  - el campo `ultimoEventoId`, para que las reglas exijan que **todo** cambio de una solicitud deje su evento en el historial;
  - un reparto rotativo de las tareas entre los usuarios RH.

  Actualizamos las reglas, los tests (de 30 a 43), el script de datos, la documentación y DECISIONES.md. Publicamos las reglas y recargamos los datos.
- **Archivos creados o modificados:**
  - `src/config/constantes.js`: colección `contadores` y `NUMERACION_SOLICITUD` (prefijo `SOL-`, 4 dígitos).
  - `src/data/modelos.js`: campo `ultimoEventoId` en Solicitud y el `@typedef` Contador.
  - `firestore.rules`:
    - reglas de `contadores` (solo sube de a 1);
    - número correlativo verificado al crear;
    - supervisor activo;
    - adjunto obligatorio según el tipo;
    - datos del permiso editables solo al reenviar;
    - trazabilidad en las dos direcciones (`ultimoEventoId` ↔ evento).
  - `scripts/tests/reglas.test.mjs`: 13 tests nuevos (contador, trazabilidad, reenvío con corrección, adjunto obligatorio); los logs de rechazos esperados quedan silenciados.
  - `scripts/seed.mjs`: guarda `ultimoEventoId` en cada solicitud y deja el contador en 10.
  - `docs/MODELO_DATOS.md`: colección `contadores`, campo `ultimoEventoId`, reparto rotativo y trazabilidad.
  - `DECISIONES.md`: corrección de la decisión 8 (reparto rotativo), ampliación de la 9 (trazabilidad en las dos direcciones) y decisión 18 (contador con transacción).
- **Conceptos aprendidos:**
  - **Transacción:** lee y escribe como una sola operación. Si lo que se leyó cambió antes de escribir, Firestore la reintenta. Por eso dos solicitudes creadas al mismo tiempo nunca reciben el mismo número.
  - **`existsAfter` + `!exists`:** juntos significan "este documento se crea en esta misma operación". Con eso las reglas comprueban que el evento del historial es nuevo y no uno viejo reutilizado.
  - **Trazabilidad en las dos direcciones:** la solicitud apunta a su último evento, y el evento tiene que coincidir con el cambio de la solicitud. Ninguno de los dos se puede escribir sin el otro.
  - **Límite de las reglas (las reglas no son filtros):** "asignar al RH con menos pendientes" exigiría que el supervisor lea tareas ajenas, así que se cambió por un reparto rotativo que no necesita leer nada.
- **Comandos usados:**
  - `git switch -c feature/flujo-aprobacion` y `git push -u origin feature/flujo-aprobacion`: crear y publicar la rama de la Fase 2.
  - `npm run test:reglas`: 43 tests, todos en verde.
  - `npm run seed:simular` y `npm run seed`: validar y recargar los datos de prueba.
  - `firebase deploy --only firestore:rules`: publicar las reglas nuevas.
- **Cómo probarlo:**
  1. `cd scripts` y después `npm run test:reglas` → `pass 43`, `fail 0`.
  2. En la consola de Firebase: existe `contadores/solicitudes` con `ultimoNumero: 10`, y cada solicitud tiene `ultimoEventoId`, que coincide con el id de un documento de su `historial`.
  3. El login sigue funcionando con los 4 usuarios.
- **Pendientes o dudas:** el seed todavía asigna RH con su propia lógica; en el próximo paso pasa a usar el módulo compartido `flujoSolicitud.js`.

---

## 2026-10-15 – Fase 2 – Paso: lógica pura del flujo (flujoSolicitud.js)

- **Qué hicimos:** escribimos el módulo que **interpreta** la tabla de transiciones: qué acciones puede hacer cada usuario sobre una solicitud, qué cambia al ejecutarlas, a quién se asigna la tarea (con el reparto rotativo de RH) y las validaciones de datos, notas y adjuntos. Es puro, es decir, no usa Firebase, así que lo probamos con 28 tests unitarios. Además, el script de datos de prueba dejó su propia copia de la lógica y ahora usa este mismo módulo.
- **Archivos creados o modificados:**
  - `src/services/flujoSolicitud.js`:
    - `accionesDisponibles`, `calcularTransicion`, `elegirUsuarioRh`;
    - `validarDatosSolicitud`, `validarArchivoAdjunto`, `validarComentario`;
    - `construirEventoNota`, `construirEventoAdjunto`;
    - `calcularCantidadDias`, `formatearNumeroSolicitud`.
  - `scripts/tests/flujoSolicitud.test.mjs`: 28 tests unitarios del módulo.
  - `scripts/seed.mjs`: `construirSolicitud` ahora usa `flujoSolicitud.js` (misma lógica que la app). La simulación da exactamente el mismo resultado que antes.
  - `scripts/package.json`: comandos `npm test` (todo) y `npm run test:flujo`.
  - `README.md`: tabla de comandos de tests.
- **Conceptos aprendidos:**
  - **Función pura:** con los mismos datos de entrada devuelve siempre el mismo resultado y no toca nada externo (base de datos, pantalla, reloj). Es la parte más fácil de testear y de reutilizar.
  - **Test unitario:** prueba una función aislada, en milisegundos y sin servicios externos. Los tests de reglas, en cambio, son de integración: necesitan el emulador.
  - **Una sola fuente de lógica:** la app y el seed llaman a `calcularTransicion`, así que no pueden "pensar distinto" sobre el flujo.
  - **Fechas en UTC:** para contar días se usa `Date.UTC`, así un cambio de horario de verano no hace que un día "dure" 23 o 25 horas. Además se detectan fechas imposibles (30 de febrero).
- **Comandos usados:**
  - `npm run test:flujo`: 28 tests en ~0,1 s.
  - `npm test`: corre las dos suites (71 tests).
  - `npm run seed:simular`: confirma que el seed refactorizado produce los mismos datos.
- **Cómo probarlo:**
  1. `cd scripts` y después `npm test` → `pass 28` y `pass 43`.
  2. `npm run seed:simular` → la misma tabla de 10 solicitudes que antes.
- **Pendientes o dudas:** el módulo todavía no lo usa ninguna pantalla; lo usa el servicio de solicitudes en el próximo paso.
