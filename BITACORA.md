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
