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

---

## 2026-10-15 – Fase 2 – Paso: repositorio y servicio de solicitudes

- **Qué hicimos:** conectamos la lógica del flujo con Firestore.
  - **Repositorio:** sabe *cómo* guardar (transacciones, ids, hora del servidor, enlace `ultimoEventoId`), pero no decide nada.
  - **Servicio:** decide *qué* guardar usando `flujoSolicitud.js`. Casos de uso: crear (con número correlativo y adjuntos), ver el detalle, ejecutar acciones del flujo, agregar notas y adjuntos, y listar las tareas y solicitudes del usuario.

  Lo probamos contra el proyecto real con un recorrido completo de 3 roles.
- **Archivos creados o modificados:**
  - `src/data/solicitudesRepositorio.js`: lecturas (solicitud, historial, adjuntos, asignadas, donde participa) y escrituras con transacción (`crearConNumero`, `actualizarConEvento`), más `marcarComoVista`.
  - `src/services/solicitudesServicio.js`: `crearSolicitud`, `obtenerDetalle`, `listarInicio`, `ejecutarAccion`, `agregarNota`, `agregarAdjunto`.
  - `src/services/archivos.js`: convertir archivos del navegador a base64 y de base64 a una URL para abrirlos.
  - `src/services/errores.js`: `aErrorAplicacion()` traduce los errores de Firestore (`permission-denied`, `unavailable`…) a mensajes en español.
  - `src/data/usuariosRepositorio.js`: `listarUsuariosPorRol()` (para el reparto RH).
  - `src/config/firebase.js`: reexporta las funciones de Firestore que se usan ahora.
  - `src/config/constantes.js`: `LIMITES_ADJUNTO.maximoAlCrear = 3`.
  - `scripts/tests/reglas.test.mjs`: test de creación con 3 adjuntos de 600 KB (44 tests).
- **Conceptos aprendidos:**
  - **Función "armar" (inversión de control):** el repositorio abre la transacción y lee los datos frescos, pero quien decide qué escribir es el servicio. Así el repositorio no conoce reglas de negocio y el servicio no conoce detalles de Firestore.
  - **Transacción y concurrencia:** cada acción se valida con la solicitud leída dentro de la transacción. Si dos personas actúan a la vez, la segunda ve el estado ya cambiado y recibe un error claro, en lugar de pisar el trabajo de la primera.
  - **Validar antes de convertir:** el tamaño del archivo se controla antes de pasarlo a base64, que lo agranda un 33 %.
  - **Mensajes al usuario vs. detalle técnico:** el usuario ve "No tenés permiso…"; el error original queda en la consola para quien depure.
- **Comandos usados:**
  - `npm run test:reglas`: 44 tests.
  - Prueba de integración en el navegador (Playwright) contra el proyecto real: Ana crea `SOL-0011` y agrega una nota → Carlos intenta devolver sin comentario (rechazado) y devuelve con comentario → Ana corrige las fechas y reenvía → Carlos aprueba → Laura adjunta un PDF (un archivo de 700 KB y un .exe fueron rechazados) y completa. El historial quedó con los 7 eventos en orden.
- **Cómo probarlo:** las pantallas llegan en los próximos pasos. Mientras tanto, con la app abierta y logueado, en la consola del navegador (F12):
  ```js
  const srv = await import('/src/services/solicitudesServicio.js');
  await srv.listarInicio();
  ```
- **Pendientes o dudas:** la prueba de integración dejó `SOL-0011` en la base; al cerrar la fase se recargan los datos de prueba.

---

## 2026-10-15 – Fase 2 – Paso: router con parámetros, marco y pantalla Nueva solicitud

- **Qué hicimos:**
  - El router ahora entiende rutas con parámetros (`#/solicitudes/:id`) y rutas restringidas por rol.
  - Creamos un marco común para las pantallas privadas: encabezado, navegación según el rol y botón Salir.
  - Construimos el formulario de **Nueva solicitud**. Muestra pistas en vivo (días máximos, si el tipo exige adjunto, cantidad de días), adjunta archivos y crea la solicitud con un aviso de confirmación.
- **Archivos creados o modificados:**
  - `src/ui/router.js`: patrones con parámetros, prioridad de rutas fijas sobre rutas con parámetros, opción `roles`, `rutaDetalle(id)` y `recargarPantalla()`.
  - `src/ui/componentes/marco.js`: encabezado y navegación comunes. El enlace "Nueva solicitud" solo aparece para el iniciador.
  - `src/ui/pantallas/nuevaSolicitudPantalla.js`: formulario de creación.
  - `src/ui/pantallas/inicioPantalla.js`: usa el marco y ofrece "Nueva solicitud" al iniciador.
  - `src/ui/pantallas/loginPantalla.js`: usa la clase de diseño de las pantallas públicas.
  - `src/ui/utils/formato.js`: fechas, tamaños, nombres de estados, tipos y roles, y colores de las etiquetas de estado.
  - `src/ui/utils/avisos.js`: avisos flotantes ("Solicitud SOL-0012 enviada…").
  - `src/styles/main.css`: estilos del marco, formularios, botones, etiquetas, tablas e historial.
  - `src/main.js`: registra la ruta de nueva solicitud, restringida al rol iniciador.
- **Conceptos aprendidos:**
  - **Ruta con parámetros:** el patrón `#/solicitudes/:id` coincide con `#/solicitudes/abc123` y entrega `{ id: 'abc123' }` a la pantalla.
  - **Prioridad de rutas:** `#/solicitudes/nueva` también encaja en `#/solicitudes/:id`. Por eso las rutas fijas se prueban primero.
  - **Componente reutilizable:** `dibujarMarco()` evita repetir el encabezado en cada pantalla.
  - **Caché del navegador:** el navegador guarda los archivos JS. Si después de un cambio no se ve lo nuevo, hay que recargar con **Ctrl + F5**. Live Server lo hace solo al guardar.
- **Comandos usados:**
  - Prueba en el navegador (Playwright):
    - un supervisor no ve "Nueva solicitud" y, si escribe la URL, vuelve al inicio;
    - el formulario vacío muestra "Elegí un tipo de permiso.";
    - Enfermedad sin certificado se rechaza;
    - con el PDF adjunto se crea `SOL-0012`;
    - no hubo errores en la consola.
- **Cómo probarlo:**
  1. Live Server → entrá como `iniciador@bprosys.test`.
  2. **Nueva solicitud** → probá elegir Enfermedad sin adjuntar nada (error) y después con un PDF chico (se crea).
  3. Entrá como `supervisor@bprosys.test`: no vas a ver "Nueva solicitud" en el menú.
- **Pendientes o dudas:** al crear, la app vuelve al inicio porque la pantalla de detalle se construye en el próximo paso.

---

## 2026-10-15 – Fase 2 – Paso: pantalla de detalle de la solicitud

- **Qué hicimos:** construimos el detalle del trámite, donde ocurre todo el flujo. Muestra:
  - la etapa en una barra de progreso y a quién está esperando;
  - los datos del permiso (editables solo para quien puede corregirlos);
  - un botón por cada acción permitida, con un comentario que queda en el historial;
  - formularios para agregar notas y adjuntos;
  - los adjuntos, que se pueden abrir;
  - la línea de tiempo completa del historial.

  Al crear una solicitud, la app ahora abre directamente su detalle.
- **Archivos creados o modificados:**
  - `src/ui/pantallas/detalleSolicitudPantalla.js`: la pantalla. No decide permisos: muestra lo que devuelve el servicio (`acciones`, `puedeCorregirDatos`, `puedeAgregarSeguimiento`).
  - `src/config/constantes.js`: `NOMBRES_ACCION` (texto de cada botón).
  - `src/services/solicitudesServicio.js`: mensaje único "La solicitud no existe o no tenés permiso para verla".
  - `src/services/errores.js`: el detalle técnico de los errores va a la consola como advertencia.
  - `src/styles/main.css`: clases del detalle (etapas, columnas, mensaje de alerta, texto para lectores de pantalla). La pantalla no usa estilos escritos dentro del HTML.
  - `src/main.js`: registra la ruta `#/solicitudes/:id`.
- **Conceptos aprendidos:**
  - **Control de campos por rol:** los datos del permiso se dibujan como campos deshabilitados. Solo se habilitan para la solicitante cuando le devolvieron la solicitud, y se guardan al "Reenviar corregida". Lo decide `puedeCorregirDatos` (flujoSolicitud.js) y lo vuelven a exigir las reglas.
  - **La UI muestra, el servicio decide:** la pantalla no tiene ningún `if (rol === ...)`: dibuja un botón por cada acción que le devuelve el servicio.
  - **No revelar si algo existe:** ante un id inexistente o ajeno se muestra el mismo mensaje, igual que hace Firestore.
  - **URL temporal (`blob:`):** los adjuntos guardados en base64 se convierten en un archivo en memoria para abrirlos en otra pestaña. Después se libera con `URL.revokeObjectURL`.
  - **Confirmación antes de acciones irreversibles:** rechazar y cancelar piden confirmación.
- **Comandos usados:**
  - Prueba en el navegador (Playwright) **haciendo clic como cada usuario**:
    1. Ana crea y agrega una nota.
    2. Carlos intenta devolver sin comentario (error) y después devuelve.
    3. Ana ve los campos habilitados, corrige las fechas a enero y reenvía (5 días).
    4. Carlos aprueba → queda "Esperando a Laura Fernández".
    5. Laura adjunta un PDF, lo abre en otra pestaña y completa.
    6. Ana ve el trámite finalizado, sin acciones ni notas, con 7 eventos en el historial.

    Un id inexistente muestra el mensaje genérico.
- **Cómo probarlo:**
  1. Live Server (si no ves los cambios: **Ctrl + F5**).
  2. Como `iniciador@bprosys.test` → **Nueva solicitud** → al enviarla se abre su detalle.
  3. Copiá la URL. Salí, entrá como `supervisor@bprosys.test`, pegá la URL y probá **Devolver** sin comentario (error) y con comentario.
  4. Volvé como iniciador: los campos ahora se pueden editar → **Reenviar corregida**.
  5. Supervisor → **Aprobar**; `rh@bprosys.test` → adjuntá un archivo → **Completar gestión**.
- **Pendientes o dudas:** por ahora a una solicitud se llega por su URL; en el próximo paso el inicio lista las tareas y solicitudes del usuario.

---

## 2026-10-15 – Fase 2 – Paso: inicio con tareas y solicitudes, prueba final y cierre

- **Qué hicimos:** el inicio muestra dos listas, "Mis tareas pendientes" (con la marca **Nueva** hasta que el asignado la abre) y "Mis solicitudes". Cada fila abre el detalle. Recargamos los datos de prueba, corrimos los 72 tests, probamos el inicio con los 4 roles, documentamos las decisiones de la fase y cerramos la fase con el merge a `main`.
- **Archivos creados o modificados:**
  - `src/ui/pantallas/inicioPantalla.js`: listas de tareas y solicitudes con estado, asignado y fecha de actualización.
  - `README.md`: estado de las fases, qué puede hacer cada rol y estructura actualizada.
  - `DECISIONES.md`: 19 (lógica pura compartida), 20 (transacciones con función "armar") y 21 (un único mensaje para "no existe" y "sin permiso").
- **Conceptos aprendidos:**
  - **"Nueva" sin campos extra:** se calcula con `asignadoA == yo` y `vistaPorAsignado == false`. Al abrir el detalle se marca como vista, y es el único cambio que no deja evento, porque no es una acción sobre el trámite.
  - **Orden en el cliente:** por ahora las listas se ordenan en el navegador. En la Fase 3 la bandeja ordena y filtra con consultas e índices compuestos de Firestore.
- **Comandos usados:**
  - `npm run seed`: recargar los datos de prueba (borra las solicitudes creadas por las pruebas).
  - `npm test`: 28 tests de lógica + 44 de reglas, todos en verde.
  - Prueba en el navegador:
    - supervisor: 3 tareas (2 nuevas); al abrir `SOL-0001` deja de ser nueva;
    - RH: 3 tareas (2 nuevas);
    - iniciadora: 1 tarea (`SOL-0004` devuelta);
    - admin: sin tareas.
  - `git merge --no-ff feature/flujo-aprobacion`: integra la fase a `main`.
- **Cómo probarlo:**
  1. Live Server → entrá con cada usuario y mirá "Mis tareas pendientes".
  2. Como supervisor, abrí `SOL-0001` (dice **Nueva**) y volvé al inicio: ya no lo dice.
  3. Recorré el flujo completo como se describe en el paso anterior.
- **Pendientes o dudas:**
  - Durante una prueba apareció una vez un error `400` en la consola al cerrar sesión mientras cargaban las listas; no se reprodujo al repetirlo (probablemente la conexión de Firestore cortándose a mitad de la carga). Queda en observación.
  - El admin y RH todavía no tienen una vista de "todas las solicitudes": llega con la bandeja de la Fase 3.

---

## Resumen de la Fase 2

Construimos el flujo completo Solicitar → Aprobar → Gestionar RH de punta a punta: crear con adjuntos, devolver con motivo, corregir y reenviar, aprobar, completar o rechazar, notas e historial. La lógica del flujo vive en un módulo puro (`flujoSolicitud.js`) que interpreta la tabla de transiciones. Lo usan la app y el script de datos de prueba, y lo cubren 28 tests unitarios. Las escrituras son transacciones que validan contra el estado real del trámite, con número correlativo sin repeticiones. Reforzamos las reglas para que la trazabilidad sea obligatoria en las dos direcciones: ningún cambio se guarda sin su evento en el historial, y ningún evento puede mentir sobre el cambio (44 tests contra el emulador). En la interfaz, la pantalla de detalle no decide permisos: muestra un botón por cada acción que el servicio habilita y bloquea los campos según el rol y el estado.

---

## 2026-10-15 – Antes de la Fase 3 – Paso: registro de bugs y correcciones

- **Qué hicimos:**
  - Creamos `BUGS.md` para que ningún error pase desapercibido, y sumamos a `CLAUDE.md` la regla de corregir los bugs abiertos antes de cada fase.
  - Registramos los 3 bugs de fases anteriores (ya resueltos) y 4 observaciones.
  - Investigamos el `400` que había quedado sin explicar. Separamos lo que es comportamiento normal de Firebase (contraseña incorrecta, reconexión del SDK) de un bug real: consultas huérfanas al cerrar sesión con datos cargando.
  - Corregimos ese bug y otro de experiencia de usuario (errores de formulario que no se ocultaban), sin romper nada.
- **Archivos creados o modificados:**
  - `BUGS.md`: registro con 5 bugs (todos resueltos) y 4 observaciones.
  - `CLAUDE.md`: sección "Registro de bugs (BUGS.md)".
  - `README.md`: `BUGS.md` en la estructura.
  - `src/services/solicitudesServicio.js`: `errorParaUsuario()`, que reconoce errores que llegan después de cerrar sesión (BUG-004).
  - `src/ui/pantallas/inicioPantalla.js` y `detalleSolicitudPantalla.js`: no dibujan si la pantalla ya fue reemplazada (BUG-004).
  - `src/ui/pantallas/loginPantalla.js`, `nuevaSolicitudPantalla.js` y `detalleSolicitudPantalla.js`: los errores se ocultan al editar (BUG-005).
- **Conceptos aprendidos:**
  - **Bug vs. comportamiento esperado:** no todo lo rojo en la consola es un bug. El `400` de una contraseña incorrecta es la respuesta correcta del servidor. Hay que reproducir el problema e identificar la URL antes de "arreglar".
  - **Petición huérfana:** una consulta que termina después de que el usuario ya cambió de pantalla o cerró sesión. Hay que comprobar si su resultado todavía tiene dónde mostrarse (`isConnected`).
  - **Rama `fix/...`:** las correcciones se hacen aparte y se integran a `main` solo después de pasar todos los tests.
  - **Test de regresión:** prueba que se agrega o repite para asegurar que un bug corregido no vuelva.
- **Comandos usados:**
  - `git switch -c fix/bugs-pre-fase-3`: rama para las correcciones.
  - Reproducción en el navegador (Playwright), registrando respuestas ≥ 400, peticiones abortadas y mensajes de consola.
  - `npm run seed` y `npm test`: datos limpios y 72 tests en verde.
  - `git merge --no-ff fix/bugs-pre-fase-3`: integra las correcciones a `main`.
- **Cómo probarlo:**
  1. Entrá con cualquier usuario y tocá **Salir** enseguida: la consola (F12) no muestra advertencias de la app.
  2. En **Nueva solicitud**, enviá vacío y después elegí un tipo: el error desaparece.
  3. Recorré el flujo completo: todo sigue funcionando.
- **Pendientes o dudas:** ninguno abierto. OBS-003 (caché) se verifica en el deploy de la Fase 6.

---

## 2026-10-15 – Antes de la Fase 3 – Paso: flujo de corrección de bugs en una rama por bug

- **Qué hicimos:** formalizamos cómo se corrige un bug para no arriesgar nunca `main`: **Detectar → Ramificar → Corregir → Testear → Integrar**, con una rama `fix/BUG-NNN-…` por cada bug.
- **Archivos creados o modificados:**
  - `CLAUDE.md`: regla con el flujo de 5 pasos, qué hacer si la corrección sale mal, y qué hacer con bugs que aparecen dentro de una rama `feature/...`.
  - `BUGS.md`: la sección "Cómo se usa" refleja el mismo flujo, con una nota sobre BUG-004 y BUG-005 (corregidos juntos antes de esta regla).
- **Conceptos aprendidos:**
  - **`main` siempre publicable:** es lo que se despliega en Vercel. Ningún cambio llega ahí sin pasar los tests.
  - **Una rama por bug:** si una corrección sale mal, se descarta solo esa rama, sin frenar otras correcciones ni la rama principal.
  - **Descartar una rama:** `git switch main` y `git branch -D fix/...` borran la rama local con todos sus cambios. `main` no se entera.
- **Comandos usados:**
  - `git switch -c docs/proceso-correccion-bugs`: incluso este cambio de documentación se hace fuera de `main`.
  - `git merge --no-ff docs/proceso-correccion-bugs`: integra el cambio a `main`.
- **Cómo probarlo:** leer la sección "Registro de bugs" de `CLAUDE.md` y "Cómo se usa" de `BUGS.md`.
- **Pendientes o dudas:** ninguno. Siguiente: aprobación del plan de la Fase 3.

---

## 2026-10-15 – Fase 3 – Paso: consultas por pestaña e índices compuestos

- **Qué hicimos:** creamos la rama `feature/bandeja` (con 0 bugs abiertos en `BUGS.md`, como pide la regla). Preparamos las consultas de las pestañas de la bandeja, ordenadas por última actualización y con tope de 200, y declaramos y publicamos los dos **índices compuestos** que necesitan.
- **Archivos creados o modificados:**
  - `src/data/solicitudesRepositorio.js`: `consultarBandeja()` (orden + tope); `listarAsignadasA` y `listarDondeParticipa` ordenadas; `listarTodas()` nueva (solo RH y admin).
  - `firestore.indexes.json`: índices `(asignadoA, fechaActualizacion desc)` y `(participantes CONTAINS, fechaActualizacion desc)`.
  - `src/config/constantes.js`: `LIMITE_BANDEJA = 200`.
  - `src/config/firebase.js`: reexporta `limit`.
  - `scripts/tests/reglas.test.mjs`: 2 tests nuevos (consultas ordenadas de cada pestaña; "Todas" permitida a RH y admin, prohibida al supervisor) → 46 tests.
- **Conceptos aprendidos:**
  - **Índice:** Firestore responde todas las consultas desde listas ya ordenadas. Los índices de un solo campo los crea solo.
  - **Índice compuesto:** hace falta cuando una consulta filtra por un campo y ordena por otro. Sin él, Firestore rechaza la consulta con `FAILED_PRECONDITION` y un link para crearlo. Los declaramos en `firestore.indexes.json` para que queden versionados.
  - **Construcción de índices:** después de publicarlos, Firestore tarda unos minutos en construirlos. Mientras tanto las consultas fallan, como comprobamos con un script.
  - **Tope (`limit`):** evita traer miles de documentos de golpe. Si se alcanza, la pantalla lo avisa (paginación queda como mejora).
- **Comandos usados:**
  - `git switch -c feature/bandeja` y `git push -u origin feature/bandeja`: rama de la fase.
  - `npm run test:reglas`: 46 tests en verde.
  - `firebase deploy --only firestore:indexes`: publica los índices.
  - Consulta con firebase-admin: confirma el `FAILED_PRECONDITION` mientras se construyen.
- **Cómo probarlo:** en la consola de Firebase → Firestore → **Índices** → pestaña "Compuesto": aparecen los dos índices, primero "Compilando" y después "Habilitado".
- **Pendientes o dudas:** la pantalla de la bandeja se construye en los próximos pasos.

---

## 2026-10-15 – Fase 3 – Paso: lógica pura de la bandeja

- **Qué hicimos:** escribimos el módulo que decide qué pestañas ve cada usuario, qué va en cada una, y cómo se filtra, ordena y busca. Es puro (sin Firebase), así que lo cubrimos con 16 tests unitarios. Sumamos el caso de uso `cargarBandeja()` al servicio.
- **Archivos creados o modificados:**
  - `src/services/bandeja.js`:
    - pestañas: `pestanasVisibles`, `armarPestanas`, `contarPestanas`;
    - búsqueda y filtros: `normalizarTexto`, `coincideBusqueda`, `filtrarSolicitudes`;
    - orden: `ordenarSolicitudes`, `procesarBandeja`.
  - `src/services/solicitudesServicio.js`: `cargarBandeja()` hace 2 consultas en paralelo (3 para RH y admin) y avisa si se alcanzó el tope.
  - `src/config/constantes.js`: `PESTANAS_BANDEJA`, `NOMBRES_PESTANA`, `ORDENES_BANDEJA`, `NOMBRES_ORDEN` y `ROLES_VEN_TODAS`.
  - `scripts/tests/bandeja.test.mjs`: 16 tests (pestañas por rol, búsqueda sin tildes, filtros combinados, rango de fechas, orden).
  - `scripts/package.json` y `README.md`: `test:flujo` pasa a llamarse `test:unitarios` e incluye los dos archivos de tests.
- **Conceptos aprendidos:**
  - **Normalización Unicode (NFD):** separa cada letra de su tilde ("ó" → "o" + "´") para poder borrar las tildes y comparar "Gómez" con "gomez".
  - **Superposición de rangos:** dos períodos se pisan si uno empieza antes de que el otro termine y termina después de que el otro empiece (`fechaFin >= desde` y `fechaInicio <= hasta`).
  - **Inmutabilidad:** `[...lista].sort()` ordena una copia, así la lista original (la que vino de Firestore) no cambia y se puede volver a filtrar.
  - **Pestaña derivada:** "Nuevas" no necesita otra consulta: es un filtro sobre "Pendientes".
- **Comandos usados:** `npm run test:unitarios` → 44 tests (28 del flujo + 16 de la bandeja).
- **Cómo probarlo:** `cd scripts` y después `npm run test:unitarios`.
- **Pendientes o dudas:** la pantalla de la bandeja va en el próximo paso. El inicio actual usa consultas que necesitan los índices compuestos, que tardan unos minutos en quedar habilitados después de publicarlos.

---

## 2026-10-15 – Fase 3 – Paso: pantalla Bandeja

- **Qué hicimos:** la bandeja reemplaza el inicio. Tiene:
  - pestañas Pendientes / Nuevas / Enviadas (y Todas para RH y admin), cada una con su contador; "Nuevas" se destaca si hay alguna;
  - búsqueda, filtros por estado, etapa, tipo y rango de fechas, y orden;
  - una tabla donde cada fila abre el detalle.

  Cada pestaña es una ruta, así que el botón Atrás vuelve a la pestaña donde estabas. Filtrar es instantáneo porque no consulta Firestore, y los filtros se recuerdan al cambiar de pestaña o volver del detalle.
- **Archivos creados o modificados:**
  - `src/ui/pantallas/bandejaPantalla.js`: la pantalla nueva.
  - `src/ui/componentes/tablaSolicitudes.js`: tabla reutilizable con la marca "Nueva" y filas clickeables.
  - `src/ui/pantallas/inicioPantalla.js`: **eliminado** (lo reemplaza la bandeja).
  - `src/services/solicitudesServicio.js`: se quitó `listarInicio()` (reemplazada por `cargarBandeja()`).
  - `src/ui/router.js`: `RUTA_INICIO` pasa a ser `#/bandeja`; nuevas `RUTA_BANDEJA_PESTANA` y `rutaBandeja()`.
  - `src/main.js`: registra `#/bandeja` y `#/bandeja/:pestana`.
  - `src/ui/componentes/marco.js`: el enlace "Bandeja" queda marcado en todas sus pestañas.
  - `src/styles/main.css`: estilos de pestañas, contadores y filtros.
- **Conceptos aprendidos:**
  - **Estado en la URL:** como la pestaña está en el hash, "Atrás" y los links compartidos funcionan sin código extra.
  - **Redibujar solo lo necesario:** al filtrar se reemplaza solo `#resultados`; los datos ya leídos se reutilizan.
  - **Defensa en profundidad:** si un supervisor escribe `#/bandeja/todas`, la pantalla lo devuelve a Pendientes; aunque no lo hiciera, las reglas rechazarían la consulta.
  - **Índices en producción:** con los índices recién publicados, la bandeja falla unos minutos (`FAILED_PRECONDITION`) hasta que Firestore termina de construirlos (~6 minutos en este caso).
- **Comandos usados:** prueba en el navegador con los 4 roles:
  - supervisor: Pendientes 3, Nuevas 2, Enviadas 7, y `#/bandeja/todas` lo devuelve a Pendientes;
  - RH: búsqueda "gomez vacaciones" (4 de 10), combinada con estado (1), filtro por tipo con orden por número, etapa finalizada, sin coincidencias, filtros conservados entre pestañas y "Limpiar filtros";
  - iniciadora: 1 pendiente (`SOL-0004` devuelta);
  - admin: Todas 10;
  - "Atrás" desde un detalle vuelve a `#/bandeja/todas`;
  - sin errores en la consola.
- **Cómo probarlo:**
  1. Live Server (Ctrl + F5 si no ves los cambios) → entrá como `rh@bprosys.test`.
  2. Probá las pestañas, buscá "gomez vacaciones" y combiná filtros.
  3. Abrí una solicitud y volvé con el botón Atrás del navegador: seguís en la misma pestaña y con los mismos filtros.
- **Pendientes o dudas:** en las capturas el texto del orden quedaba cortado ("Actualizadas recien…"). Las etiquetas se acortaron ("Más recientes", etc.) y ese cambio entra con el commit del próximo paso, porque está en `constantes.js`, que ya tiene cambios de ese paso.

---

## 2026-10-15 – Fase 3 – Paso: matriz de control de campos por rol y gestión RH

- **Qué hicimos:** el control de campos por rol pasó de un `if` suelto a una **matriz** (`MATRIZ_CAMPOS`) que define, para cada campo, quién lo edita, en qué estado, con qué acción se guarda y quién lo ve. Sumamos dos campos de gestión RH:
  - `referenciaRh`: referencia de liquidación, obligatoria para completar;
  - `diasDescontados`: entre 0 y los días del permiso.

  Los carga solo el RH asignado al completar. Las reglas exigen lo mismo, y el detalle se dibuja a partir de la matriz.
- **Archivos creados o modificados:**
  - `src/config/constantes.js`: `CAMPOS`, `ACCESO_CAMPO` y `MATRIZ_CAMPOS`. También van acá las etiquetas de orden más cortas que quedaron pendientes del paso anterior.
  - `src/services/flujoSolicitud.js`: `accesoACampos()` (editable / lectura / oculto) y `validarGestionRh()`. `calcularTransicion()` deja los campos RH en `null` al crear y los exige al completar.
  - `src/services/solicitudesServicio.js`: `obtenerDetalle()` devuelve `campos` (la matriz aplicada al usuario); `ejecutarAccion()` recibe `datosGestionRh`.
  - `src/ui/pantallas/detalleSolicitudPantalla.js`: los campos se habilitan según la matriz; nueva sección "Gestión RH" (oculta, de lectura o editable).
  - `firestore.rules`: campos nuevos en `null` al crear; solo el RH asignado los carga al completar; referencia de 1 a 40 caracteres; días entre 0 y `cantidadDias`.
  - `scripts/tests/reglas.test.mjs`: 6 tests nuevos de gestión RH (52 en total).
  - `scripts/tests/flujoSolicitud.test.mjs`: 10 tests nuevos de la matriz y la validación RH (54 unitarios).
  - `scripts/seed.mjs` y `scripts/datosPrueba.mjs`: las solicitudes completadas traen referencia y días descontados.
  - `src/data/modelos.js` y `docs/MODELO_DATOS.md`: campos nuevos y tabla de la matriz.
- **Conceptos aprendidos:**
  - **Configuración en vez de `if`:** la matriz es un dato. Sumar un campo o cambiar quién lo edita se hace en `constantes.js`, sin tocar la pantalla.
  - **Editar vs. ver:** las reglas de Firestore protegen la **edición** campo por campo, pero no pueden ocultar campos de un documento que el usuario puede leer. La visibilidad es de la interfaz, y por eso esos campos no guardan datos sensibles.
  - **Validar en tres lugares:** pantalla (número entre 0 y N), servicio (`validarGestionRh`) y reglas (`gestionRhValida`).
- **Comandos usados:**
  - `npm test`: 54 unitarios + 52 de reglas, todos en verde.
  - `firebase deploy --only firestore:rules` y `npm run seed`: reglas publicadas y datos recargados.
  - Prueba en el navegador:
    - Laura intenta completar sin referencia (error) y con 9 días en un permiso de 3 (error); completa con 3 y los campos quedan de solo lectura;
    - Ana ve la gestión RH solo una vez completada, y edita los datos solo en su devuelta;
    - Carlos no ve la gestión RH mientras está en curso;
    - Martín (admin) la ve en lectura.
- **Cómo probarlo:**
  1. Como `rh@bprosys.test`, abrí `SOL-0005`: la sección "Gestión RH" está habilitada. Probá completar sin referencia.
  2. Como `iniciador@bprosys.test`, abrí la misma solicitud antes y después de completarla.
- **Pendientes o dudas:** durante esta prueba se detectaron **dos bugs** en código que ya está en `main`: el seed cierra las sesiones abiertas (BUG-006) y la columna de acciones del detalle se desborda en pantallas medianas (BUG-007). Se corrigen cada uno en su rama `fix/...` desde `main`, como pide la regla.
## 2026-10-15 – Corrección – BUG-006: recargar los datos de prueba cerraba las sesiones

- **Qué hicimos:** primer bug corregido con el flujo **Detectar → Ramificar → Corregir → Testear → Integrar**. Lo detectamos durante la Fase 3: un `400` de `accounts:lookup` al recargar la página. Creamos la rama `fix/BUG-006-seed-cierra-sesiones` desde `main`, corregimos el seed para que no cambie la contraseña de los usuarios que ya existen, lo probamos y lo integramos a `main`.
- **Archivos creados o modificados:**
  - `scripts/seed.mjs`: a los usuarios existentes ya no se les cambia la contraseña. Opción nueva `--restablecer-claves`.
  - `scripts/package.json`: comando `npm run seed:restablecer-claves`.
  - `BUGS.md`: BUG-006 (resuelto) y BUG-007 (abierto, se corrige en su propia rama).
  - `README.md`: el comando nuevo.
- **Conceptos aprendidos:**
  - **Revocación de sesiones:** Firebase invalida los tokens de un usuario cuando cambia su contraseña. Es una medida de seguridad: si alguien te robó la sesión, cambiar la clave lo saca.
  - **Efecto secundario:** un script "idempotente" en los datos puede igual tener efectos en otro lado (las sesiones). Hay que mirar todo lo que toca.
  - **Leer el log antes de adivinar:** el archivo de consola de Playwright mostraba la URL exacta (`accounts:lookup`), y con eso se encontró la causa.
- **Comandos usados:**
  - `git switch main`, `git pull` y `git switch -c fix/BUG-006-seed-cierra-sesiones`: rama del bug desde `main` actualizado.
  - Prueba de regresión: iniciar sesión → `npm run seed` → recargar la página → la sesión sigue abierta, sin errores.
  - `npm test`: 28 + 44 en verde.
  - `git merge --no-ff fix/BUG-006-seed-cierra-sesiones` (en `main`): integración.
- **Cómo probarlo:** abrí la app y logueate; en otra terminal corré `npm run seed` (desde `scripts/`); recargá la app: seguís logueado.
- **Pendientes o dudas:** BUG-007 (desborde de la columna de acciones) sigue abierto y se corrige a continuación, en su propia rama.

---

## 2026-10-15 – Corrección – BUG-007: desbordes horizontales en el detalle y en celulares

- **Qué hicimos:** en la rama `fix/BUG-007-desborde-columna-acciones`, creada desde `main`, medimos con precisión qué elemento se desbordaba antes de tocar el CSS. Encontramos la causa (el `min-width: auto` de los elementos de una grilla) y dos lugares donde aparecía: la columna de acciones del detalle y las tablas en celulares. Corregimos los dos con la misma regla y verificamos en 10 anchos de pantalla.
- **Archivos creados o modificados:**
  - `src/styles/main.css`: `min-width: 0` en los hijos de las grillas (`.contenido`, `.columna`, `.formulario`, `.campo`) y `max-width: 100%` en el selector de archivos.
  - `BUGS.md`: BUG-007 resuelto (con las dos manifestaciones). Quedan 0 abiertos.
- **Conceptos aprendidos:**
  - **`min-width: auto` en CSS Grid y Flexbox:** por defecto un elemento no se achica por debajo del ancho mínimo de su contenido. Si ese contenido es rígido (un `<textarea>`, un `<input type="file">`, una tabla), empuja hacia afuera aunque tenga `width: 100%`. `min-width: 0` le permite ajustarse.
  - **Medir antes de corregir:** se buscó con código qué elemento sobrepasaba su contenedor (`getBoundingClientRect`) en cada ancho. Así apareció la segunda manifestación, en celulares, que en una captura no se veía.
  - **Diseño responsive:** probar en varios anchos (celular, tablet, notebook, monitor grande), no solo en el de la propia pantalla.
- **Comandos usados:**
  - `git switch -c fix/BUG-007-desborde-columna-acciones` (desde `main`).
  - Medición en el navegador de desborde y scroll horizontal en 1550, 1440, 1280, 1024, 900, 800, 761, 760, 600 y 390 px (y 320 px en el inicio): todo en 0.
  - `npm test`: 28 + 44 en verde.
  - `git merge --no-ff fix/BUG-007-desborde-columna-acciones` (en `main`).
- **Cómo probarlo:** abrí el detalle de una solicitud con acciones y achicá la ventana del navegador de a poco: la columna derecha nunca sobresale. En modo celular (F12 → ícono de dispositivo móvil) la tabla del inicio se desplaza dentro de su recuadro, y la página no se corre de costado.
- **Pendientes o dudas:** ninguno. Siguiente: traer `main` (con BUG-006 y BUG-007) a `feature/bandeja` y terminar la Fase 3.

---

## 2026-10-15 – Fase 3 – Paso: integración de correcciones, prueba final y cierre

- **Qué hicimos:**
  - Trajimos a `feature/bandeja` las correcciones BUG-006 y BUG-007 que ya estaban en `main`, y resolvimos 3 conflictos de merge quedándonos con las dos versiones.
  - Hicimos una prueba completa de la fase con los 4 roles, documentamos las decisiones 22 y 23 y cerramos la fase con el merge a `main`.
- **Archivos creados o modificados:**
  - `BITACORA.md`, `README.md` y `scripts/package.json`: conflictos resueltos (entradas de las dos ramas, filas del README de las dos ramas, los comandos `seed:restablecer-claves` y `test:unitarios`).
  - `README.md`: Fase 3 completa, qué puede hacer cada rol (bandeja, matriz, gestión RH) y estructura actualizada.
  - `DECISIONES.md`: 22 (consulta por pestaña + filtrado en el navegador + índices) y 23 (matriz de control de campos por rol, con su límite: Firestore no oculta campos sueltos).
- **Conceptos aprendidos:**
  - **Conflicto de merge:** cuando dos ramas cambian las mismas líneas, git marca el archivo con `<<<<<<<`, `=======` y `>>>>>>>`. Se edita para quedarse con lo correcto (acá, las dos cosas), se borran las marcas y se commitea. Antes de commitear se verifica que todo siga funcionando (106 tests).
  - **Actualizar una rama con `main`:** `git merge main` dentro de la rama de trabajo trae las correcciones antes de integrarla. Así el merge final a `main` no tiene sorpresas.
  - **Sincronización en tests de interfaz:** `waitForURL` termina cuando cambia la URL, pero el navegador redibuja recién en el evento `hashchange`. Hay que esperar una condición de la pantalla nueva (por ejemplo, que la pestaña activa sea la correcta), no la URL. Un test que falla "a veces" casi siempre es esto, no un bug de la app.
- **Comandos usados:**
  - `git merge main` (en `feature/bandeja`), resolución de conflictos y `git commit --no-edit`.
  - `npm test` (54 + 52) y `npm run seed`.
  - Prueba en el navegador del flujo completo:
    1. Ana crea `SOL-0011` (enfermedad con certificado) → aparece en sus Enviadas.
    2. Carlos la ve en Nuevas (3) y la aprueba → su bandeja baja a Pendientes 3 / Nuevas 2.
    3. Laura la completa con referencia `LIQ-2026-1101` y 3 días.
    4. Ana la ve completada, con la gestión RH en solo lectura y 4 eventos en el historial.
    5. Martín filtra Todas por Completada → `SOL-0011`, `SOL-0009`, `SOL-0008` (4 de 4 intentos).

    La bandeja no tiene scroll horizontal en 1440, 1024, 800, 390 ni 320 px, y la consola no registró errores.
  - `git merge --no-ff feature/bandeja` (en `main`).
- **Cómo probarlo:** Live Server (Ctrl + F5) y repetir el recorrido de arriba con los usuarios de prueba.
- **Pendientes o dudas:** `BUGS.md` tiene 0 abiertos. La paginación de la bandeja (más de 200 solicitudes por lista) queda como mejora.

---

## Resumen de la Fase 3

Construimos la bandeja de tareas: pestañas Pendientes, Nuevas y Enviadas (y Todas para RH y admin) con contadores, búsqueda sin tildes ni mayúsculas, filtros por estado, etapa, tipo y rango de fechas, y orden. Cada pestaña es una consulta a Firestore con su índice compuesto, y filtrar y buscar ocurre en el navegador con lógica pura y testeada. El control de campos por rol pasó a ser una matriz de configuración que decide, campo por campo, quién edita y quién ve según el rol y el estado. La sumamos con los datos de gestión RH, que solo carga el RH asignado al completar, y las reglas de Firestore exigen lo mismo. Durante la fase detectamos dos bugs en código ya publicado (el seed cerraba sesiones y desbordes de diseño). Los corregimos cada uno en su propia rama desde `main`, con tests de regresión, y los integramos a la fase resolviendo los conflictos de merge. Terminamos con 106 tests automáticos en verde y 0 bugs abiertos.

---

## 2026-10-15 – Fase 4 – Paso: reglas de negocio, reglas de Firestore y datos para el mantenimiento

- **Qué hicimos:**
  - Definimos las reglas del mantenimiento antes de dibujar pantallas. Son las decisiones 24 y 25.
  - **Baja y cambio de rol bloqueados** mientras el usuario:
    - sea el admin que opera;
    - participe en trámites abiertos;
    - sea supervisor de colaboradores activos;
    - sea el último RH activo.
  - **Roles:** son los 4 del sistema. El admin edita el nombre y la descripción, los permisos son de solo lectura, y "crear rol" solo vuelve a crear uno de los 4 si falta.
  - Toda la lógica quedó en módulos puros con tests. Las reglas de Firestore suman lo que el servidor sí puede garantizar.
  - Los datos de prueba suman 2 usuarios para probar el mantenimiento.
- **Archivos creados o modificados:**
  - `src/config/constantes.js`: `LIMITES_USUARIO`, `LIMITES_ROL`, `NOMBRES_PERMISO`, `DESCRIPCIONES_ROL` (antes estaba en `datosPrueba.mjs`), filtros del listado y `OPERACIONES_USUARIO`.
  - `src/services/gestionUsuarios.js` (nuevo, puro): valida los datos de un usuario, calcula los motivos de bloqueo, valida la reactivación y filtra el listado.
  - `src/services/gestionRoles.js` (nuevo, puro): arma el catálogo de los 4 roles, detecta los faltantes, valida nombre y descripción y prepara la creación de un rol faltante.
  - `firestore.rules`:
    - **usuarios:** el área es obligatoria; el supervisor tiene que ser coherente (solo el iniciador tiene, existe, es supervisor y está activo, y no es él mismo); un usuario nuevo empieza activo; el admin no puede darse de baja ni cambiarse el rol.
    - **roles:** solo las 4 claves del sistema; los permisos no se editan; solo se crea un rol con sus permisos de fábrica.
  - `scripts/tests/gestionUsuarios.test.mjs` (21 tests) y `gestionRoles.test.mjs` (7) (nuevos); `reglas.test.mjs`: +17 tests de usuarios y roles.
  - `scripts/datosPrueba.mjs` y `seed.mjs`: Sofía Díaz (supervisora sin equipo activo) y Pedro Ruiz (iniciador dado de baja); los roles se escriben sin `activo`.
  - `src/data/modelos.js` y `docs/MODELO_DATOS.md`: el modelo de `Rol` sin `activo` y la regla del supervisor.
  - `DECISIONES.md`: decisiones 24 y 25.
- **Conceptos aprendidos:**
  - **Lo que las reglas pueden y no pueden validar:** las reglas ven un documento por vez, y pueden leer otros con `get()` o `exists()`, pero no pueden contar ni consultar colecciones. Por eso "¿tiene trámites abiertos?" lo decide el servicio, y "¿su supervisor está activo?" lo deciden las dos capas.
  - **Operador ternario en las reglas:** `d.rol == 'iniciador' ? (condiciones del iniciador) : d.supervisorId == null` aplica una condición distinta según el rol.
  - **Tests que vigilan una copia:** los tests de reglas importan `PERMISOS_POR_ROL` desde `constantes.js`. Si la copia que está en `firestore.rules` se desincroniza, fallan.
- **Comandos usados:**
  - `git switch -c feature/mantenimiento`: rama de la fase.
  - `npm run test:unitarios`: 82 tests, 28 nuevos.
  - `npm run test:reglas`: 69 tests, 17 nuevos.
  - `npm run seed:simular`, después `firebase deploy --only firestore:rules` y `npm run seed`: se publicaron las reglas y se recargaron los datos (6 usuarios, roles sin `activo`).
- **Cómo probarlo:** desde `scripts/`, correr `npm test`. Para comprobar que la baja lógica funciona, entrar con `pedro.ruiz@bprosys.test` / `Bprosys2026!`: tiene que aparecer "Tu usuario está dado de baja".
- **Pendientes o dudas:** las pantallas de usuarios y roles se hacen en los pasos siguientes.

## 2026-10-15 – Fase 4 – Paso: listado de usuarios para el administrador

- **Qué hicimos:**
  - El admin tiene un nuevo enlace "Usuarios" en el menú, con el listado de todos los colaboradores: nombre, email, rol, área, supervisor y estado.
  - Se puede buscar por nombre, email o área, sin importar tildes ni mayúsculas, y filtrar por rol y por estado (activos o dados de baja).
  - Los datos se leen una vez y los filtros solo redibujan la tabla.
  - Antes de la pantalla hicimos un refactor chico: `usuarioRequerido` y `errorParaUsuario` (la protección del BUG-004) pasaron de `solicitudesServicio.js` a `authServicio.js` para reutilizarlos. `usuarioRequerido` ahora además puede exigir un rol.
- **Archivos creados o modificados:**
  - `src/services/authServicio.js`: exporta `usuarioRequerido(roles)` y `errorParaUsuario`.
  - `src/services/solicitudesServicio.js`: usa las utilidades de `authServicio.js` en lugar de sus copias locales.
  - `src/services/usuariosServicio.js` (nuevo): casos de uso del mantenimiento; por ahora `cargarUsuarios`, solo para el admin.
  - `src/data/usuariosRepositorio.js`: `listarUsuarios()`, ordenado por nombre.
  - `src/ui/pantallas/usuariosPantalla.js` (nuevo): el listado con búsqueda y filtros.
  - `src/ui/componentes/marco.js`: enlaces del menú por rol ("Nueva solicitud" para el iniciador, "Usuarios" para el admin). La sección actual se marca también en sus subrutas.
  - `src/ui/router.js`: rutas del mantenimiento (`#/usuarios`, `#/usuarios/nuevo`, `#/usuarios/:id`, `#/roles`).
  - `src/main.js`: registra `#/usuarios`, restringida al rol admin.
  - `src/ui/utils/html.js`: `htmlOpciones()`, que antes era una función local de la bandeja, para reutilizarla en los formularios.
  - `src/ui/pantallas/bandejaPantalla.js`: usa `htmlOpciones()`.
- **Conceptos aprendidos:**
  - **Refactor:** cambiar la estructura del código sin cambiar lo que hace. Acá movimos dos funciones a un lugar compartido para no copiarlas en cada servicio nuevo. Se verifica que todo siga igual: la bandeja carga como antes.
  - **Defensa en capas:** el mantenimiento se protege en cuatro lugares:
    1. el menú no muestra el enlace;
    2. el router redirige a otro rol;
    3. el servicio exige el rol admin;
    4. firestore.rules solo deja escribir al admin.

    Solo la última es seguridad real. Las otras evitan pantallas y llamadas inútiles.
- **Comandos usados:**
  - Un servidor local temporal sin caché y una prueba en el navegador:
    - Carlos no ve "Usuarios", y `#/usuarios` lo lleva a la bandeja.
    - Martín ve los 6 usuarios ("5 activos"): "GOMEZ" encuentra a Ana, el filtro Supervisor muestra a Carlos y Sofía, y Dados de baja muestra a Pedro.
    - "Limpiar filtros" vuelve a los 6.
    - Sin scroll horizontal en 390 y 320 px, y sin errores en la consola.
- **Cómo probarlo:** entrar con `admin@bprosys.test` / `Bprosys2026!` → menú "Usuarios" → probar la búsqueda y los filtros. Entrar con otro rol: el enlace no aparece y la ruta `#/usuarios` redirige a la bandeja.
- **Pendientes o dudas:** el alta, la ficha y los roles se hacen en los pasos siguientes. Hasta entonces, el enlace de cada fila lleva a una ruta que todavía no existe, que vuelve a la bandeja.

## 2026-10-15 – Fase 4 – Paso: alta de usuarios sin cerrar la sesión del admin

- **Qué hicimos:**
  - El admin da de alta usuarios desde "Usuarios → Nuevo usuario": nombre, email, rol, área, supervisor (solo para el iniciador) y contraseña inicial.
  - La cuenta de acceso se crea en una **segunda instancia de Firebase**, así la sesión del admin no cambia. Después el admin, con su sesión, guarda el perfil.
  - Si el alta se corta entre los dos pasos, reintentarla con el mismo email y la misma contraseña la completa (decisión 26).
- **Archivos creados o modificados:**
  - `src/config/firebase.js`:
    - `obtenerAuthAltas()`: la instancia secundaria, con `inMemoryPersistence`, que se crea recién cuando se usa;
    - reexporta `createUserWithEmailAndPassword`, `sendPasswordResetEmail` y `setDoc`.
  - `src/data/authAdminRepositorio.js` (nuevo): crea una cuenta, comprueba una cuenta existente y envía el mail de contraseña. Siempre cierra la sesión de la instancia secundaria (`finally`).
  - `src/data/usuariosRepositorio.js`: `crearPerfil()` y `actualizarPerfil()`.
  - `src/services/usuariosServicio.js`: `prepararAlta()` y `crearUsuario()`. Valida, crea o completa la cuenta y guarda el perfil, con mensajes en español para los errores de Auth.
  - `src/ui/componentes/formularioUsuario.js` (nuevo): los campos del usuario, que el alta comparte con la ficha. El supervisor solo aparece si el rol es iniciador.
  - `src/ui/pantallas/altaUsuarioPantalla.js` (nuevo) y el botón "Nuevo usuario" en el listado.
  - `src/main.js`: ruta `#/usuarios/nuevo`, solo para el admin.
  - `src/styles/main.css`: regla global `[hidden] { display: none !important; }`.
  - `.gitignore`: `scripts/tmp-*` (scripts temporales de prueba que usan la clave de servicio).
  - `DECISIONES.md` (26 nueva y 14 marcada como implementada) y `BUGS.md` (OBS-001 ampliada).
- **Conceptos aprendidos:**
  - **Instancias de Firebase:** `initializeApp(config, 'altaUsuarios')` crea una app independiente con su propia sesión de Auth. Crear una cuenta loguea a esa cuenta solo en esa instancia, y el admin sigue logueado en la principal.
  - **`try/finally`:** el `finally` se ejecuta tanto si la operación sale bien como si falla. Lo usamos para cerrar siempre la sesión de la instancia secundaria.
  - **El atributo `hidden` y el CSS:** `hidden` equivale a `display: none`, pero cualquier regla de CSS con `display` (por ejemplo, `.campo { display: grid }`) le gana. La regla global `[hidden] { display: none !important; }` lo asegura.
  - **Operaciones que no pueden ser atómicas:** crear la cuenta en Auth y guardar el perfil en Firestore son dos sistemas distintos, y no hay una transacción que los abarque. Por eso se diseñó cómo recuperarse si el segundo paso falla.
- **Comandos usados:**
  - Prueba en el navegador:
    - **Formulario:** el supervisor está oculto hasta elegir "Iniciador" y lista solo supervisores activos (Carlos y Sofía). El error se oculta al escribir.
    - **Validaciones:** campos vacíos → "Ingresá el nombre y apellido."; email repetido en mayúsculas → "Ya existe un usuario con ese email."; contraseña de 5 caracteres → error; sin supervisor → error.
    - **Alta de Lucía Torres:** aparece en el listado (7 usuarios), el encabezado sigue diciendo "Martín Sosa · Administrador" también después de recargar, y Lucía entra con su contraseña inicial como iniciadora.
  - `node tmp-prueba-fase4.mjs crear-cuenta-sin-perfil` (script temporal, ignorado por git) para simular un alta interrumpida:
    - esa cuenta no puede entrar ("no tiene un perfil asignado");
    - reintentar el alta con otra contraseña → "Ya existe una cuenta de acceso con ese email.";
    - con la misma contraseña → se completa y el admin sigue logueado.
- **Cómo probarlo:** con `admin@bprosys.test`, ir a Usuarios → Nuevo usuario y dar de alta a alguien (por ejemplo, rol Iniciador, supervisor Carlos Pérez). Después cerrar sesión y entrar con el email y la contraseña inicial de la persona nueva.
- **Pendientes o dudas:** por ahora, después del alta se vuelve al listado; en el paso siguiente va a abrir la ficha. Los usuarios creados en las pruebas se borran al cerrar la fase con el script temporal.

## 2026-10-15 – Fase 4 – Paso: ficha del usuario (edición, baja, reactivación y contraseña)

- **Qué hicimos:** cada fila del listado abre la ficha del usuario. Desde ahí el admin puede:
  - **Editar** nombre, rol, área y supervisor. El email no se edita.
  - **Dar de baja**, con confirmación. Si está bloqueada, la ficha muestra los motivos y deshabilita el botón.
  - **Reactivar.** Un iniciador solo se reactiva si su supervisor está activo.
  - **Enviar el mail** para que el usuario elija una contraseña nueva.
  - **Ver sus trámites abiertos** (con enlace a cada uno) y, si es supervisor, sus colaboradores.

  Al elegir otro rol, la ficha avisa al instante si el cambio está bloqueado. El servicio vuelve a decidirlo al guardar, con datos leídos en ese momento.
- **Archivos creados o modificados:**
  - `src/ui/pantallas/fichaUsuarioPantalla.js` (nuevo) y la ruta `#/usuarios/:id` en `src/main.js`. Después del alta se abre la ficha.
  - `src/services/usuariosServicio.js`: `obtenerFichaUsuario`, `actualizarUsuario` (con el control del cambio de rol), `darDeBaja`, `reactivar` y `enviarCambioDeContrasena`.
  - `src/data/solicitudesRepositorio.js`: `listarParticipacionesDe(uid)`. Trae todas las solicitudes donde el usuario participa, sin tope, para detectar trámites abiertos.
  - `src/services/authServicio.js`: `actualizarUsuarioActual()`, para que el encabezado muestre el nombre nuevo cuando el admin se edita a sí mismo.
  - `src/ui/utils/operaciones.js` (nuevo): `ejecutarConEstado()`, que se mudó desde el detalle de solicitudes para compartirlo con la ficha.
  - `src/ui/pantallas/detalleSolicitudPantalla.js`: usa la utilidad compartida.
  - Mensajes neutros en cuanto a género ("Se dio de baja a…", "(de baja)") en `gestionUsuarios.js`, el servicio y las pantallas.
  - `src/styles/main.css`: lista de motivos de bloqueo.
- **Conceptos aprendidos:**
  - **Validar en el cliente y volver a validar en el servidor:** el aviso de la ficha usa los datos de cuando se abrió. Si en ese tiempo alguien creó un trámite, el servicio lo detecta al guardar porque lee todo de nuevo.
  - **Clausura** (*closure*): `motivosCambioDeRol(rolNuevo)` es una función que el servicio devuelve "recordando" los usuarios y trámites que cargó. La pantalla la llama cada vez que cambia el rol, sin volver a consultar Firestore.
  - **Pruebas de regresión:** cuando se mueve código compartido, se vuelve a probar la pantalla que lo usaba. Acá, agregar una nota en el detalle.
- **Comandos usados:** prueba en el navegador con Martín:
  - **Bloqueos:** Carlos está bloqueado por 7 trámites abiertos y 2 colaboradores; si se le elige otro rol, aparece el aviso y "Guardar" se deshabilita. Laura está bloqueada por 3 trámites y por ser la única RH. Martín no puede darse de baja ni cambiarse el rol. Ana está bloqueada por sus trámites. Sofía no tiene bloqueos.
  - **Baja y reactivación:**
    - Se reactiva a Sofía, se le asigna a Pedro (que está de baja) y se da de baja a Sofía.
    - Reactivar a Pedro queda bloqueado: "el usuario de su supervisor (Sofía Díaz) está dado de baja".
    - Con Carlos como supervisor, Pedro se reactiva. Siendo un usuario activo, el selector ya no ofrece supervisores de baja.
  - **Lucía (RH):**
    - Con dos RH activas, Laura deja de ser "la única RH".
    - El mail de contraseña se envía.
    - Al dar de baja a Lucía, el motivo de Laura vuelve.
  - **Martín cambia su nombre** y el encabezado se actualiza al instante; después se restaura.
  - **Sofía de baja** no puede iniciar sesión.
  - **Regresión del detalle:** Ana agrega una nota (el historial pasa de 1 a 2 eventos). Sin scroll horizontal en 390 y 320 px. `npm run test:unitarios`: 82 en verde.
- **Cómo probarlo:**
  1. Con `admin@bprosys.test`, abrir Usuarios → Carlos Pérez: los motivos del bloqueo y el aviso al cambiar el rol.
  2. Abrir Sofía Díaz → Dar de baja.
  3. Entrar como `sofia.diaz@bprosys.test`: aparece "Tu usuario está dado de baja".
  4. Volver como admin y reactivarla.
- **Pendientes o dudas:**
  - **Hallazgo de las pruebas, no de la app:** cuando el MCP de Playwright intercepta un `confirm()`, devuelve el control pero el script sigue ejecutándose. Eso mezcló dos pruebas. Desde entonces, en las pruebas automáticas se reemplaza `window.confirm`.
  - Los cambios que hicieron las pruebas en los datos se revierten al cerrar la fase con `npm run seed` y el script temporal.

## 2026-10-15 – Fase 4 – Paso: gestión de roles

- **Qué hicimos:**
  - Nueva pantalla "Roles" para el admin, con una tarjeta por cada uno de los 4 roles del sistema: descripción, permisos (solo lectura) y cantidad de usuarios activos y dados de baja.
  - **Edición:** "Editar" cambia el nombre visible y la descripción. El nombre nuevo se ve en toda la app: menú, listados, filtros, historial y encabezado de cada usuario.
  - **Rol perdido:** si falta el documento de uno de los 4 roles, la tarjeta lo marca como "Falta en el catálogo" y aparece el formulario **"Crear rol"**, que solo ofrece los roles faltantes y los crea con sus permisos de fábrica.
  - **Sin roles faltantes:** la sección explica por qué no se pueden crear roles nuevos.
  - **Si se pierde el documento de un rol, los usuarios con ese rol siguen trabajando.**
- **Archivos creados o modificados:**
  - `src/data/rolesRepositorio.js` (nuevo): `listarRoles`, `crearRol` y `actualizarRol`.
  - `src/services/catalogoRoles.js` (nuevo): los nombres de los roles en memoria. Se cargan una vez al iniciar sesión y, si algo falla, se usa el nombre de fábrica.
  - `src/services/rolesServicio.js` (nuevo): `obtenerGestionRoles`, `guardarRol` y `crearRolFaltante`, solo para el admin.
  - `src/services/authServicio.js`: carga el catálogo al validar el perfil y lo limpia al cerrar sesión.
  - `src/ui/utils/formato.js`: `nombreRol()` usa el catálogo.
  - `src/ui/pantallas/rolesPantalla.js` (nuevo), el enlace "Roles" en el menú del admin y la ruta `#/roles` en `src/main.js`.
  - `src/styles/main.css`: grilla de tarjetas de roles (2 columnas en pantallas anchas, 1 en celulares) y lista de permisos.
  - `DECISIONES.md`: la 25 explica cómo se cargan los nombres.
- **Conceptos aprendidos:**
  - **Caché en memoria con valor por defecto:** el catálogo guarda los nombres en una variable del módulo. Si no hay dato, `nombreDeRol()` devuelve el nombre de fábrica, así la pantalla nunca muestra un rol vacío.
  - **Evitar lecturas duplicadas:** al iniciar sesión, el login y el observador de sesión piden el catálogo casi a la vez. `cargaEnCurso` guarda la promesa y el segundo pedido reutiliza la misma lectura.
  - **Diseño a prueba de datos perdidos:** el rol de cada usuario se valida contra la lista fija `ROLES` del código, no contra la colección. Por eso borrar un documento de `roles` no deja a nadie afuera.
- **Comandos usados:**
  - **Prueba en el navegador:**
    - Las 4 tarjetas muestran sus permisos y conteos.
    - Un nombre vacío da "Ingresá el nombre del rol.".
    - RH pasa a "RRHH" y se ve en el listado de usuarios, en el filtro de rol y en el encabezado de Laura.
    - Laura no ve "Roles", y `#/roles` la lleva a la bandeja.
  - `node tmp-prueba-fase4.mjs borrar-rol rh` (script temporal):
    - Laura entra igual y ve sus 3 solicitudes.
    - El admin ve "Falta en el catálogo", el formulario "Crear rol" ofrece solo `rh` con sus permisos de fábrica, y al crearlo la tarjeta vuelve.
  - Sin scroll horizontal en 390 y 320 px, y sin errores en la consola. Captura revisada; se agregó espacio entre la descripción y los permisos.
- **Cómo probarlo:**
  1. Con `admin@bprosys.test`, ir a "Roles" → Editar "Recursos Humanos" → cambiarle el nombre.
  2. Entrar como `rh@bprosys.test` y ver el nombre nuevo en el encabezado.
  3. Para ver el caso del rol perdido: borrar el documento `roles/rh` desde la consola de Firebase, recargar "Roles" y crearlo de nuevo.
- **Pendientes o dudas:** queda la prueba integral, la documentación y el cierre de la fase.

## 2026-10-15 – Fase 4 – Corrección: BUG-008 (avisos que quedaban después de cerrar sesión)

- **Qué hicimos:** en la prueba integral de la Fase 4 apareció un aviso de la sesión anterior ("SOL-0011: Completar gestión ✔") en la sesión del admin. El código de los avisos es de la Fase 2, que ya está en `main`, así que seguimos el flujo de BUGS.md:
  1. registrar el bug;
  2. crear una rama desde `main`;
  3. corregir;
  4. testear;
  5. integrar a `main`.

  Al cerrar sesión ahora se borran los avisos pendientes.
- **Archivos creados o modificados:**
  - `src/ui/utils/avisos.js`: nueva función `limpiarAvisos()`.
  - `src/main.js`: la llama cuando no hay sesión.
  - `BUGS.md`: BUG-008.
- **Conceptos aprendidos:**
  - **Elementos fuera de la pantalla:** la zona de avisos vive en el `<body>`, fuera del contenedor que se redibuja. Por eso sobrevive al cambio de pantalla, que es lo que se busca. La contracara es que hay que limpiarla a mano cuando el cambio es de usuario y no solo de pantalla.
  - **Por qué se corrige en una rama aparte:** `main` es lo que se publica. La corrección se prueba en su rama y recién después se integra, sin mezclarla con el trabajo de la Fase 4, que todavía no terminó.
- **Comandos usados:**
  - `git switch main` + `git pull` + `git switch -c fix/BUG-008-avisos-entre-sesiones`.
  - `npm test`: 54 + 52 en verde.
  - Prueba en el navegador: nota → "Salir" inmediato → el login sin avisos; al volver a entrar, los avisos siguen funcionando.
  - `git merge --no-ff` a `main` y `git push`.
- **Cómo probarlo:** agregar una nota y apretar "Salir" enseguida. El aviso "Nota agregada" no tiene que quedar en la pantalla de login.
- **Pendientes o dudas:** traer la corrección a `feature/mantenimiento` (`git merge main`) antes de cerrar la Fase 4.

## 2026-10-15 – Fase 4 – Corrección: script temporal subido por error a `main` (OBS-005)

- **Qué hicimos:**
  - Al integrar el BUG-008 se subió a `main`, por error, el script temporal de pruebas `scripts/tmp-prueba-fase4.mjs`. La regla del `.gitignore` que lo excluye solo existía en la rama de la Fase 4.
  - Lo sacamos del repositorio en una rama `fix/`, sin borrarlo del disco, y agregamos la regla al `.gitignore` de `main`.
  - Verificamos que no se subió ninguna clave: el script solo lee `serviceAccountKey.json`, que sigue ignorado.
- **Archivos creados o modificados:**
  - `.gitignore`: `scripts/tmp-*`.
  - `scripts/tmp-prueba-fase4.mjs`: deja de estar en el repositorio.
  - `BUGS.md`: OBS-005, con la lección.
- **Conceptos aprendidos:**
  - **`git rm --cached`:** deja de seguir un archivo en git sin borrarlo del disco.
  - **El `.gitignore` depende de la rama:** cada rama tiene su versión del `.gitignore`. Una regla agregada en una rama de trabajo no protege nada en las demás hasta que se integra.
  - **Cuándo reescribir el historial:** si se hubiera subido una clave, no alcanzaría con borrarla en un commit nuevo. Habría que revocarla en Firebase y, además, limpiar el historial. Acá no había ningún secreto, así que alcanza con un commit que lo saque.
- **Comandos usados:**
  - `git grep -n "BEGIN PRIVATE KEY\|private_key" HEAD`: sin resultados.
  - `git switch -c fix/quitar-script-temporal`, `git rm --cached scripts/tmp-prueba-fase4.mjs`, commit, `git merge --no-ff` a `main` y `git push`.
- **Cómo probarlo:** `git ls-files scripts` ya no lista el script, y `git check-ignore -v scripts/tmp-prueba-fase4.mjs` muestra la regla que lo ignora.
- **Pendientes o dudas:** ninguno.

## 2026-10-15 – Fase 4 – Paso: integración de correcciones, prueba integral y cierre

- **Qué hicimos:**
  - Trajimos a `feature/mantenimiento` las correcciones de `main` (BUG-008 y OBS-005) y resolvimos 2 conflictos de merge, conservando las dos versiones.
  - Hicimos una prueba integral del mantenimiento junto con el flujo de solicitudes, actualizamos el README y cerramos la fase.
- **Archivos creados o modificados:**
  - `src/main.js` y `BITACORA.md`: conflictos resueltos.
    - En `main.js`, las importaciones de las pantallas nuevas más `limpiarAvisos`.
    - En la bitácora, las entradas de la fase seguidas de las dos correcciones.
  - `README.md`: Fase 4 ✅, qué puede hacer el admin, la estructura nueva y los usuarios de prueba Sofía y Pedro.
- **Conceptos aprendidos:**
  - **Prueba integral:** además de probar cada pantalla por separado, se prueba un caso de punta a punta que cruza módulos. Acá, que los bloqueos del mantenimiento sigan el ciclo de vida real de un trámite.
  - **Sincronizar bien una prueba automática:** dos veces una prueba "falló" porque esperaba un elemento que también existía en otra pantalla. Pasó con un `<tr>` que contenía el nombre del supervisor y con el campo `email` de la ficha. La solución es esperar algo que identifique sin ambigüedad a la pantalla esperada.
- **Comandos usados:**
  - `git merge main` (en la rama de la fase), resolución de conflictos y `git commit --no-edit`.
  - `npm test`: 82 unitarios y 69 de reglas, en verde.
  - Prueba integral en el navegador:
    1. Martín da de alta a Lucía Torres (iniciadora, supervisora Sofía) y se abre su ficha.
    2. Lucía pide un permiso (`SOL-0011`) y Sofía lo aprueba.
    3. Mientras está abierto, Lucía no se puede dar de baja (participa en `SOL-0011`), y Sofía tampoco (por `SOL-0011` y por tener a Lucía a cargo).
    4. Laura lo completa (`LIQ-2026-1102`). Lucía queda libre y se la da de baja; entonces Sofía también se puede dar de baja.
    5. Al salir con un aviso a la vista, el login queda sin avisos (BUG-008 integrado).
  - Limpieza: con un script temporal ignorado por git, se borraron los 3 usuarios de prueba que quedaban (el de "alta interrumpida" ya se había borrado). Después, `npm run seed` (6 usuarios, 10 solicitudes, contador en 10) y se borró el script.
  - `git merge --no-ff feature/mantenimiento` (en `main`) y `git push`.
- **Cómo probarlo:** Live Server (Ctrl + F5) y repetir el recorrido de arriba con los usuarios de prueba.
- **Pendientes o dudas:**
  - `BUGS.md` tiene 0 bugs abiertos.
  - Quedan como mejoras:
    - obligar a cambiar la contraseña inicial en el primer ingreso;
    - paginar la bandeja (más de 200 solicitudes por lista).

---

## Resumen de la Fase 4

Construimos el mantenimiento de usuarios y roles para el administrador:
- **Usuarios:** listado con búsqueda, alta, edición, baja lógica, reactivación y mail para cambiar la contraseña.
- **Alta sin perder la sesión:** la cuenta se crea en una segunda instancia de Firebase, así el admin sigue logueado, y si el alta se corta a mitad de camino se puede completar reintentándola.
- **Bloqueos:** la baja y el cambio de rol se bloquean mientras el usuario tenga trámites abiertos, colaboradores a cargo o sea el último RH, para que ningún trámite quede trabado. La pantalla muestra los motivos y el servicio los vuelve a verificar al guardar.
- **Roles:** son los 4 que conoce el flujo. El admin edita su nombre y descripción y puede volver a crear uno que se pierda, siempre con sus permisos de fábrica.
- **Calidad:** la lógica es pura y testeada, y las reglas de Firestore suman lo que el servidor puede garantizar. Terminamos con 151 tests en verde.
- **Proceso:** encontramos y corregimos un bug en código ya publicado (BUG-008) y un error de proceso (OBS-005) con el flujo de ramas `fix/`, sin tocar `main` directamente.

---

## 2026-10-15 – Fase 5 – Paso: lógica de los reportes, consultas y tests

- **Qué hicimos:** preparamos todo lo que necesitan los dos reportes de gestión antes de dibujarlos (decisión 27).
  - **Distribución por etapa:** se arma sumando conteos por estado, que Firestore cuenta en el servidor sin enviar los documentos.
  - **Carga por usuario:** se arma agrupando los trámites abiertos por persona asignada: pendientes, nuevas (sin abrir) y el trámite más antiguo de cada bandeja.
  - **Problemas:** el reporte marca si algún trámite quedó asignado a alguien dado de baja o inexistente.
- **Archivos creados o modificados:**
  - `src/config/constantes.js`:
    - `ESTADOS_ABIERTOS`;
    - `ETAPA_DE_ESTADO`, la etapa de cada estado;
    - `ROLES_VEN_REPORTES` (RH y admin).
  - `src/services/reportes.js` (nuevo, puro): `distribucionPorEtapa()` y `cargaPorUsuario()`.
  - `src/data/solicitudesRepositorio.js`: `contarPorEstado()` (consulta de conteo) y `listarAbiertas()`.
  - `src/config/firebase.js`: reexporta `getCountFromServer`.
  - `scripts/tests/reportes.test.mjs` (nuevo): 9 tests. Uno verifica que `ETAPA_DE_ESTADO` coincida con `TRANSICIONES`.
  - `scripts/tests/reglas.test.mjs`: 4 tests de las consultas de los reportes y la importación de `assert`.
  - `scripts/package.json`: suma `reportes.test.mjs` a `test:unitarios`.
  - `DECISIONES.md`: decisión 27.
- **Conceptos aprendidos:**
  - **Consulta de agregación (`count()`):** le pide a Firestore solo el número de documentos que cumplen una condición. No viajan los documentos y cuesta 1 lectura cada 1.000 contados.
  - **Las reglas también se aplican a los conteos:** contar es leer. Un supervisor no puede contar todas las solicitudes, por la misma razón por la que no puede listarlas.
  - **Un test que vigila dos tablas:** `ETAPA_DE_ESTADO` repite información de `TRANSICIONES`. El test las compara, así que si alguien cambia una y se olvida de la otra, falla.
- **Comandos usados:**
  - `git switch -c feature/reportes`.
  - `npm run test:unitarios`: 91, 9 nuevos.
  - `npm run test:reglas`: 73, 4 nuevos. Con los datos de los tests, RH cuenta 3 en aprobación y admin lista 5 abiertos.
- **Cómo probarlo:** desde `scripts/`, correr `npm test`.
- **Pendientes o dudas:** la pantalla de reportes se hace en los pasos siguientes.

## 2026-10-15 – Fase 5 – Paso: pantalla de reportes y distribución por etapa

- **Qué hicimos:**
  - RH y admin tienen un enlace nuevo, "Reportes", con:
    - **tres indicadores:** total de trámites, en curso y finalizados;
    - **el gráfico de distribución por etapa:** barras horizontales en el orden del proceso, con el valor y el porcentaje al final de cada barra y el detalle por estado debajo de cada etapa;
    - **la tabla de datos** desplegable, como alternativa accesible.
  - **Tooltip:** cada barra lo muestra con el mouse y con el teclado (Tab).
  - **Actualizar:** el botón vuelve a leer los datos; mientras tanto, el reporte anterior queda atenuado, sin saltos.
  - **Diseño:** seguimos la guía de visualización de datos. Primero elegimos la forma (barras horizontales), después el color: las etapas tienen un orden, así que llevan una escala de un solo tono, de claro a oscuro. Por último **validamos la paleta con un script** en vez de elegirla a ojo.
- **Archivos creados o modificados:**
  - `src/services/reportesServicio.js` (nuevo): `cargarReportes()`. Hace en paralelo 6 conteos, los abiertos y los usuarios. Solo para RH y admin.
  - `src/ui/componentes/graficoBarras.js` (nuevo): gráfico de barras horizontales en HTML y CSS, sin librerías, con segmentos apilables.
  - `src/ui/utils/tooltip.js` (nuevo): tooltip con mouse y teclado, contenido con `textContent` y un solo listener de scroll para toda la app.
  - `src/ui/pantallas/reportesPantalla.js` (nuevo).
  - `src/ui/utils/formato.js`: `formatearMomento()`, para una fecha y hora del navegador.
  - `src/ui/router.js`, `src/main.js` y `src/ui/componentes/marco.js`: ruta `#/reportes` para RH y admin, y el enlace en el menú.
  - `src/styles/main.css`:
    - colores de los gráficos como variables;
    - indicadores, barras, tooltip y tabla de datos;
    - solo las filas con `data-id` (las que abren algo) muestran la manito;
    - corrección del BUG-009.
  - `BUGS.md`: BUG-009.
- **Conceptos aprendidos:**
  - **Escala ordinal:** cuando las categorías tienen un orden (las etapas de un proceso), el color puede mostrar ese orden con un solo tono, de claro a oscuro. Si no tuvieran orden, todas las barras irían del mismo color.
  - **Validar colores con un script:** el validador revisa que los tonos se distingan también con daltonismo y que tengan contraste suficiente contra el fondo. "Se ven distintos" no alcanza.
  - **Gráficos accesibles:** el texto nunca va en el color de la serie, cada valor también está escrito o en la tabla, y el tooltip funciona con el teclado.
  - **Delegación de eventos:** el tooltip escucha en el contenedor y usa `closest('[data-tooltip-valor]')`. Un solo listener sirve aunque las barras se vuelvan a dibujar.
- **Comandos usados:**
  - `node scripts/validate_palette.js "#86b6ef,#3987e5,#1c5cab,#0d366b" --ordinal --surface "#ffffff"`: todo PASS.
  - `node scripts/validate_palette.js "#2a78d6,#eb6834" --surface "#ffffff"`: todo PASS, con una diferencia con daltonismo de ΔE 24,7.
  - Prueba en el navegador:
    - Carlos no ve "Reportes", y `#/reportes` lo lleva a la bandeja.
    - Laura ve 10 / 7 / 3, y por etapa 1 (10%), 3, 3 y 3 (30%), con "Completada 2 · Rechazada 1". Coincide con el seed.
    - El tooltip funciona con el mouse y con el teclado, la tabla también suma 10 y "Actualizar" funciona.
    - Sin errores en la consola. Se corrigió el doble punto de "p. m..".
    - El desborde horizontal se midió en 7 anchos y todos dan 0, después de corregir el BUG-009.
- **Cómo probarlo:** entrar con `rh@bprosys.test` o `admin@bprosys.test` → Reportes. Pasar el mouse por las barras, o recorrerlas con Tab, y abrir "Ver los datos en una tabla".
- **Pendientes o dudas:** en el paso siguiente se suma la carga de pendientes por usuario.

## 2026-10-15 – Fase 5 – Paso: carga de tareas pendientes por usuario

- **Qué hicimos:** sumamos el segundo reporte del enunciado.
  - **Barra apilada por persona:** las tareas que ya vio (azul) y las nuevas, todavía sin abrir (naranja), con el total al final.
  - **Detalle debajo de cada nombre:** el rol y el trámite más antiguo de su bandeja ("Más antiguo: SOL-0006 (hace 10 días)").
  - **Supervisores y RH sin tareas:** aparecen con 0; que alguien que aprueba esté libre también es información.
  - **Leyenda:** son dos series, así que lleva leyenda, con la forma de las barras.
  - **Datos y alertas:** tiene su tabla de datos y un aviso si algún trámite quedara asignado a alguien dado de baja.
  - **Indicador nuevo:** "Sin abrir".
- **Archivos creados o modificados:**
  - `src/ui/pantallas/reportesPantalla.js`: `htmlCarga()`, el indicador "Sin abrir" y el texto del trámite más antiguo.
  - `src/styles/main.css`: colores de las dos series (`--serie-1`, `--serie-2`), la leyenda y la alineación de los indicadores (`align-content: start`).
- **Conceptos aprendidos:**
  - **Barras apiladas (parte de un todo):** el largo total es la carga y los colores muestran de qué está hecha. Los segmentos se separan con 2 px de fondo, no con un borde.
  - **Leyenda solo cuando hay más de una serie:** con una sola serie (las etapas) el título alcanza; con dos (vistas y nuevas), la leyenda es la forma confiable de saber qué es cada color. Además, el tooltip lo dice con palabras.
  - **Un evento que depende del dibujado:** en la prueba automática el evento `scroll` no llegaba, ni siquiera a un listener de prueba, porque el navegador de pruebas no dibuja cuadros mientras está en segundo plano. La lógica se verificó disparando el evento a mano. No es un bug de la app.
- **Comandos usados:** prueba en el navegador con el admin:
  - **Con el seed:**
    - Carlos tiene 3 (1 vista y 2 nuevas), Laura 3 (1 + 2), Ana 1 nueva y Sofía 0.
    - "Sin abrir" da 5 y la tabla suma 7 pendientes y 5 nuevas.
  - **Prueba dinámica, Carlos aprueba SOL-0002:**
    - Laura pasa a 4 (1 vista y 3 nuevas) y Carlos a 2.
    - En la distribución, Aprobación queda en 2 (20%) y Gestión RH en 4 (40%).
    - "Sin abrir" pasa a 6.
  - **Tooltip, desborde y alineación:**
    - El tooltip funciona con el mouse ("3 tareas nuevas / Laura Fernández · todavía sin abrir") y con el teclado.
    - Desborde horizontal 0 en 7 anchos, de 1440 a 320 px.
    - Los 4 números de los indicadores quedan a la misma altura.
- **Cómo probarlo:** entrar con `admin@bprosys.test` → Reportes. Después, entrar como `supervisor@bprosys.test`, aprobar un trámite, volver a Reportes y apretar "Actualizar": la carga pasa de Carlos a Laura.
- **Pendientes o dudas:** queda la prueba integral, la documentación y el cierre. La prueba aprobó SOL-0002, así que se recargan los datos de prueba antes de cerrar.

## 2026-10-15 – Fase 5 – Paso: prueba integral y cierre

- **Qué hicimos:** recargamos los datos de prueba, corrimos todos los tests, hicimos una prueba final en el navegador, actualizamos el README y cerramos la fase con el merge a `main`.
- **Archivos creados o modificados:** `README.md`: Fase 5 ✅, qué muestran los reportes y quién los ve, y la estructura nueva.
- **Conceptos aprendidos:**
  - **Regresión de un cambio de CSS global:** la regla de la manito sobre las filas pasó a aplicarse solo a `tr[data-id]`. Se verificó que la bandeja y usuarios siguen mostrándola y abriendo el detalle, y que las tablas de datos de los reportes ya no la muestran.
- **Comandos usados:**
  - `npm run seed`: la prueba dinámica del paso anterior había aprobado SOL-0002.
  - `npm test`: 91 unitarios y 73 de reglas, en verde.
  - Prueba en el navegador:
    - **RH ve los números del seed:** indicadores 10 / 7 / 3 / 5; etapas 1 / 3 / 3 / 3; carga Carlos 3, Laura 3, Ana 1 y Sofía 0.
    - **Cursor de las tablas:** las filas de la bandeja y de usuarios muestran la manito y la bandeja abre el detalle; las de las tablas de datos, no.
    - **Menú del admin:** Bandeja, Reportes, Usuarios, Roles.
  - `git merge --no-ff feature/reportes` (en `main`) y `git push`.
- **Cómo probarlo:** Live Server (Ctrl + F5) → entrar con `rh@bprosys.test` o `admin@bprosys.test` → Reportes.
- **Pendientes o dudas:** `BUGS.md` tiene 0 bugs abiertos. Para la Fase 6 quedan anotados el modo oscuro de los gráficos (con su paleta validada para fondo oscuro) y la exportación de los reportes, si se quiere sumar.

---

## Resumen de la Fase 5

Construimos los reportes de gestión para RH y admin:
- **Distribución por etapa:** sale de consultas de conteo que Firestore resuelve en el servidor, sin enviar los documentos. El reporte cuesta lo mismo con 10 trámites que con 10.000.
- **Carga por usuario:** descarga solo los trámites abiertos, la parte viva de los datos, y muestra por persona cuántas tareas tiene, cuántas no abrió y la más antigua.
- **Gráficos:** están hechos en HTML y CSS sin librerías, siguiendo una guía de visualización de datos. Las paletas se validaron con un script de contraste y daltonismo, cada gráfico tiene su tabla de datos y el tooltip funciona con el teclado.
- **Calidad:** la lógica está en un módulo puro con tests, y los tests de reglas comprueban que un supervisor no puede hacer estas consultas. Durante la fase apareció un desborde en celulares (BUG-009), que se corrigió en la misma rama antes del merge, con una medición automática en 7 anchos.
- **Resultado:** 164 tests en verde.

---

## 2026-10-15 – Fase 6 – Paso: base visual del diseño final (claro y oscuro)

- **Qué hicimos:** rehicimos la base visual siguiendo un plan de diseño propio para esta app: una herramienta interna que usan todos los colaboradores, también desde el celular.
  - **Tipografía:** Atkinson Hyperlegible Next, diseñada para leerse bien en cualquier condición. El cero con barra es parte de esa legibilidad.
  - **Encabezado:** en azul tinta, con el ícono de la app (un calendario con una tilde), el nombre y el rol del usuario.
  - **Paneles:** planos con borde fino. Antes todo era una tarjeta con la misma sombra; ahora la sombra queda para lo que flota (avisos y tooltip).
  - **Títulos:** el de cada pantalla va sobre el fondo, sin panel.
  - **Modo oscuro:** sigue la configuración del sistema, con los colores de los gráficos validados también para fondo oscuro.
  - **Colores con significado:** el naranja marca "nueva / sin abrir" en la bandeja, igual que en el gráfico de carga.
  - **Arreglos:**
    - había dos `<main>` anidados;
    - cada pantalla tiene su título de pestaña ("Bandeja – Permisos", "SOL-0004 – Permisos");
    - foco visible para el teclado;
    - se respeta la preferencia de menos movimiento;
    - los bordes de los campos tienen contraste suficiente.
- **Archivos creados o modificados:**
  - `index.html`: `<div id="app">` en vez de `<main>`, la tipografía, el ícono, la descripción y el color de la barra del navegador en el celular.
  - `favicon.svg` (nuevo): el ícono de la app.
  - `src/styles/main.css`:
    - variables de color para claro y oscuro (sin colores escritos a mano en los componentes);
    - tipografía y foco visible;
    - encabezado en grilla: escritorio en una fila; en el celular, las secciones abajo y bajando de línea;
    - paneles planos, `.tarjeta--titulo`, botones y campos;
    - "Nueva" en naranja;
    - colores de los gráficos en oscuro.
  - `src/ui/componentes/marco.js`: el encabezado nuevo (`ICONO_APP`, el nombre y el rol en dos líneas).
  - `src/ui/router.js`: la opción `titulo` de cada ruta y `ponerTitulo()`.
  - `src/main.js`: el título de cada pantalla.
  - Pantallas:
    - detalle y ficha: título con el dato cargado;
    - bandeja, roles, reportes y ficha: título sin panel;
    - bandeja: subtítulo según el rol, en vez de repetir el nombre.
- **Conceptos aprendidos:**
  - **Variables de diseño (tokens):** los colores están definidos una sola vez. El modo oscuro solo redefine esas variables dentro de `@media (prefers-color-scheme: dark)`; los componentes no cambian.
  - **Un solo `<main>` por página:** los lectores de pantalla usan `<main>` para saltar al contenido. Si hay dos anidados, ese atajo no sirve.
  - **Contraste de los controles (WCAG 1.4.11):** el borde de un campo tiene que tener 3:1 contra el fondo para que se vea dónde escribir.
  - **Contenido oculto que no se nota:** un menú que se desplaza de costado con la barra oculta esconde opciones. En el celular, mejor que los enlaces bajen de línea.
- **Comandos usados:**
  - `node scripts/validate_palette.js … --mode dark --surface "#17202b"`: las etapas (escala) y la carga (dos series) pasan también en oscuro.
  - Prueba en el navegador:
    - título "Bandeja – Permisos", la tipografía cargada y un solo `<main>`;
    - capturas en claro y oscuro;
    - los números de solicitud ya no se cortan;
    - sin desborde en 390 y 320 px y los cuatro enlaces del admin visibles en el celular;
    - sin errores en la consola.
- **Cómo probarlo:** Live Server (Ctrl + F5). Para ver el modo oscuro, activarlo en la configuración del sistema operativo (o en las herramientas de desarrollo del navegador: Rendering → prefers-color-scheme).
- **Pendientes o dudas:** el login y el detalle (con el recorrido del trámite) se rediseñan en el paso siguiente.

## 2026-10-15 – Fase 6 – Paso: login y recorrido del trámite

- **Qué hicimos:** rediseñamos las dos pantallas donde aparece el elemento distintivo de la app, el recorrido del trámite.
  - **Login en dos columnas:**
    - a la izquierda, en azul tinta: el nombre de la app y los 3 pasos de un trámite, contados desde quien lo usa ("Pedís el permiso → Tu supervisor lo revisa → Recursos Humanos lo gestiona");
    - a la derecha: el formulario y las **cuentas de demostración**, un botón por rol ("Entrar como Ana Gómez") que completa el formulario y lo envía.
  - **Detalle:** las 4 etapas conectadas por una línea. Las hechas llevan ✓ y relleno, la actual un anillo, y las que faltan van en gris. En el celular se apilan en vertical.
  - **Bugs:** se registró y corrigió el BUG-010 (el recorrido desbordaba a 320 px).
- **Archivos creados o modificados:**
  - `src/ui/pantallas/loginPantalla.js`: el login nuevo, con los pasos del trámite y las cuentas de demostración.
  - `src/config/constantes.js`: `MOSTRAR_CUENTAS_DEMO`, `CONTRASENA_DEMO` y `CUENTAS_DEMO`.
  - `src/ui/pantallas/detalleSolicitudPantalla.js`: el recorrido con estados (hecho, actual, pendiente) y texto para lectores de pantalla.
  - `src/styles/main.css`: el login, el recorrido (horizontal, vertical en el celular y vertical en el login) y los botones de demostración.
  - `BUGS.md` (BUG-010) y `DECISIONES.md` (decisión 28).
- **Conceptos aprendidos:**
  - **Especificidad de CSS:** dos reglas con la misma especificidad gana la que está más abajo en el archivo. `.boton { display: inline-block }` le ganaba a `.cuentas-demo__boton { display: grid }`; se resolvió con `.cuentas-demo .cuentas-demo__boton`.
  - **`aria-current="step"`:** le dice al lector de pantalla cuál es el paso actual de una secuencia. Además, cada paso tiene un texto oculto ("hecha", "etapa actual", "pendiente"), así la información no depende solo del color.
  - **`requestSubmit()`:** envía el formulario como si se apretara el botón, pasando por el mismo código que un ingreso a mano.
- **Comandos usados:** prueba en el navegador:
  - **Login:**
    - título "Ingresar – Permisos" y un solo `<main>`;
    - capturas en claro, oscuro y a 390 px (desborde 0);
    - con una contraseña incorrecta aparece "Email o contraseña incorrectos." (el `400` en la consola es la OBS-001);
    - "Entrar como Carlos Pérez" entra como el supervisor.
  - **Detalle:**
    - SOL-0004 (devuelta): Solicitud es la actual;
    - SOL-0006: Gestión RH es la actual, con las dos anteriores hechas;
    - SOL-0008 (completada): todas hechas;
    - título de la pestaña "SOL-0004 – Permisos".
  - **Desborde:** 0 en 8 anchos, después del BUG-010.
- **Cómo probarlo:** abrir la app (Ctrl + F5) → el login nuevo → "Entrar como Laura Fernández" → abrir una solicitud de la bandeja y ver el recorrido. Achicar la ventana para ver cómo se apila.
- **Pendientes o dudas:** queda la revisión visual de todas las pantallas (claro, oscuro y celular) y medir el contraste.

## 2026-10-15 – Fase 6 – Paso: revisión visual completa y contraste medido

- **Qué hicimos:**
  - Recorrimos las 9 pantallas de la app con el rol que corresponde a cada una (bandeja, nueva solicitud, detalle con y sin acciones, usuarios, alta, ficha, roles y reportes). En cada una medimos el desborde en 1280, 390 y 320 px y revisamos capturas en claro, oscuro y celular.
  - **Contraste medido:** calculamos el contraste WCAG de los 46 pares de texto y fondo que usa la app, en los dos modos. Todos cumplen AA, y quedó como **test automático**.
  - Lo que se vio en las capturas se corrigió.
- **Archivos creados o modificados:**
  - `scripts/tests/contraste.test.mjs` (nuevo): lee las variables de color de `main.css` y verifica cada par (4,5:1 para texto y 3:1 para bordes de campos y foco). Se probó al revés: con un gris demasiado claro, el test falla e indica qué par no cumple.
  - `scripts/package.json`: suma el test a `test:unitarios`.
  - `src/styles/main.css`:
    - los campos no se estiran cuando el vecino de la fila tiene una ayuda (`align-content: start`);
    - aire arriba de un título de sección que sigue a otro contenido;
    - filtros de a dos por fila desde 390 px;
    - botones de acción del mismo ancho;
    - el botón del selector de archivos con el estilo de la app.
- **Conceptos aprendidos:**
  - **Contraste WCAG:** la relación entre la luminancia del texto y la del fondo. 4,5:1 es el mínimo para texto normal y 3:1 para lo que no es texto (bordes, foco). Se calcula con una fórmula, no a ojo.
  - **`align-content: start` en una grilla:** sin esto, una fila de la grilla reparte su alto sobrante entre los elementos y un campo se estira para igualar a su vecino.
  - **`::file-selector-button`:** permite darle estilo al botón del `<input type="file">` sin reemplazar el control nativo, que sigue siendo accesible.
- **Comandos usados:**
  - Script de contraste con el validador de la guía: 46/46 pares en AA.
  - `npm run test:unitarios`: 94 tests (los 91 anteriores más 3 de contraste).
  - Prueba en el navegador:
    - 9 pantallas × 3 anchos, todas con desborde 0, y el título de pestaña correcto en cada una.
    - Después de los arreglos: en la ficha, "Nombre" y "Email" quedan a la misma altura (43 px); los 3 botones de acción miden 196 px; a 390 px los filtros ocupan 366 px de alto, la mitad que antes.
- **Cómo probarlo:**
  - Desde `scripts/`, `npm run test:unitarios`.
  - En el navegador, recorrer las pantallas en claro y oscuro, y con la ventana angosta.
- **Pendientes o dudas:** una prueba "falló" porque se cambió de pantalla en los milisegundos en que Firebase todavía no había informado la sesión. Una persona no puede hacerlo, y un link directo funciona porque el router espera a la sesión antes de resolver la primera ruta. No es un bug de la app.
