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
