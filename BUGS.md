# Registro de bugs

Todo bug o error detectado queda registrado acá, **aunque se corrija en el momento**, para que no pase desapercibido y quede el historial de cómo se resolvió.

**Cómo se usa** (regla de `CLAUDE.md`):
- Cada bug lleva un ID correlativo `BUG-NNN` y estos datos: fase en que se detectó, severidad, estado, cómo reproducirlo, causa, solución, commit y test de regresión.
- **Nunca se corrige en `main`.** Flujo de cada bug:

  ```
  Detectar → Ramificar → Corregir → Testear → Integrar
  (Abierto)  fix/BUG-NNN-…  (En curso)  npm test +   merge a main
                                        regresión +  (Resuelto)
                                        prueba manual
  ```

  Una rama por bug, creada desde `main` actualizado. Si la corrección sale mal, se descarta la rama y `main` queda intacto. Un bug causado por código de una rama `feature/...` que todavía no llegó a `main` se corrige en esa misma rama antes del merge.
- **Antes de iniciar una nueva fase** no puede quedar ningún bug abierto.
- Lo que no es un bug de la app (comportamiento del SDK, del navegador o del entorno) va en **Observaciones**, con la explicación de por qué no se corrige.
- Cuando ayuda a entender por qué existe un código, se lo referencia con un comentario `// BUGS.md · BUG-NNN`.

**Severidad:**
- **Alta:** bloquea una funcionalidad o compromete la seguridad o los datos.
- **Media:** la funcionalidad anda, pero con un comportamiento incorrecto visible.
- **Baja:** detalle de experiencia de usuario o ruido técnico sin efecto en los datos.

**Estados:** Abierto · En curso · Resuelto.

---

## Resumen

| ID | Título | Severidad | Estado | Detectado | Resuelto en |
|---|---|---|---|---|---|
| BUG-001 | El error del login de un usuario dado de baja se borraba | Media | ✅ Resuelto | Fase 1 | `5264cd7` |
| BUG-002 | Condición invertida de `vistaPorAsignado` en las reglas bloqueaba aprobar y devolver | Alta | ✅ Resuelto | Fase 1 | `e181234` |
| BUG-003 | Mensaje confuso al abrir una solicitud inexistente o ajena | Baja | ✅ Resuelto | Fase 2 | `e761737` |
| BUG-004 | Consultas huérfanas al cerrar sesión con datos cargando | Baja | ✅ Resuelto | Fase 2 | `fix/bugs-pre-fase-3` |
| BUG-005 | Los mensajes de error de los formularios no se ocultaban al corregir | Baja | ✅ Resuelto | Fase 2 | `fix/bugs-pre-fase-3` |
| BUG-006 | Recargar los datos de prueba cerraba las sesiones abiertas | Baja | ✅ Resuelto | Fase 3 | `fix/BUG-006-seed-cierra-sesiones` |
| BUG-007 | Desbordes horizontales: columna de acciones del detalle y tablas en celulares | Media | ✅ Resuelto | Fase 3 | `fix/BUG-007-desborde-columna-acciones` |
| BUG-008 | El aviso de una acción seguía visible después de cerrar sesión | Baja | ✅ Resuelto | Fase 4 | `fix/BUG-008-avisos-entre-sesiones` |

**Abiertos: 0**

> BUG-004 y BUG-005 se corrigieron juntos en la rama `fix/bugs-pre-fase-3`, antes de existir la regla de "una rama por bug". Desde ahora cada bug va en su propia rama `fix/BUG-NNN-…`.

---

## Detalle

### BUG-001 · El error del login de un usuario dado de baja se borraba
- **Detectado:** Fase 1, al escribir el login (revisión del código, antes del commit).
- **Severidad:** Media.
- **Cómo reproducir:** iniciar sesión con un usuario con `activo: false`. El mensaje "Tu usuario está dado de baja" aparecía y desaparecía al instante.
- **Causa:** condición de carrera. El servicio cerraba la sesión, el observador de sesión pedía otra vez la pantalla de login y el router la redibujaba, borrando el mensaje.
- **Solución:** el router no redibuja la pantalla que ya está mostrando para el mismo usuario (`pantallaActual` en `src/ui/router.js`).
- **Commit:** `5264cd7` (feat: login con email y contraseña).
- **Test de regresión:** manual (login de usuario inactivo). El acceso de usuarios inactivos lo cubre el test de reglas "un usuario dado de baja pierde el acceso a sus solicitudes".

### BUG-002 · Condición invertida de `vistaPorAsignado` en las reglas
- **Detectado:** Fase 1, por los tests automáticos de reglas, **antes de publicarlas**.
- **Severidad:** Alta (habría bloqueado aprobar y devolver en producción).
- **Cómo reproducir:** con las reglas anteriores, un supervisor aprueba una solicitud → `permission-denied`.
- **Causa:** la regla exigía `vistaPorAsignado == !(estado final)`, al revés de la regla de negocio (al pasar a alguien nuevo, la solicitud todavía no fue vista).
- **Solución:** `despues().vistaPorAsignado == (despues().estadoActual in estadosFinales())`.
- **Commit:** `e181234` (feat: reglas de seguridad de Firestore por rol).
- **Test de regresión:** `scripts/tests/reglas.test.mjs` → "el supervisor asignado aprueba y queda asignada a RH" y "devolver exige un comentario en el historial".

### BUG-003 · Mensaje confuso al abrir una solicitud inexistente o ajena
- **Detectado:** Fase 2, prueba en el navegador del detalle.
- **Severidad:** Baja.
- **Cómo reproducir:** abrir `#/solicitudes/noexiste123` → "No tenés permiso… Puede que la solicitud haya cambiado: recargá la página".
- **Causa:** Firestore responde `permission-denied` también para documentos inexistentes, y se mostraba el mensaje genérico de permisos.
- **Solución:** `obtenerDetalle` traduce ese caso a "La solicitud no existe o no tenés permiso para verla" (un único mensaje, para no revelar qué ids existen; ver DECISIONES.md #21).
- **Commit:** `e761737` (feat: detalle de la solicitud…).
- **Test de regresión:** manual (abrir un id inexistente).

### BUG-004 · Consultas huérfanas al cerrar sesión con datos cargando
- **Detectado:** Fase 2. Primero se vio un `400` aislado en la consola; se reprodujo antes de iniciar la Fase 3.
- **Severidad:** Baja (sin efecto en los datos; ruido en la consola y una carrera real).
- **Cómo reproducir:** iniciar sesión y tocar **Salir** enseguida, antes de que carguen las listas del inicio → en la consola aparece `[errores] permission-denied`.
- **Causa:** cerrar sesión no cancela las consultas en curso. Al terminar, ya sin sesión, Firestore las rechaza, y la pantalla intentaba dibujar el error sobre una pantalla que ya había sido reemplazada.
- **Solución:**
  1. `solicitudesServicio.errorParaUsuario()`: si cuando llega el error ya no hay sesión, se informa "Tu sesión terminó", sin advertencia técnica.
  2. Las pantallas con carga asíncrona (inicio y detalle) verifican `principal.isConnected` después de cada `await` y no dibujan si la pantalla ya no está.
- **Commit:** rama `fix/bugs-pre-fase-3`.
- **Test de regresión:** prueba en el navegador. Tres ingresos con "Salir" inmediato → sin advertencias en la consola. Después se repitió el flujo completo (crear → devolver → reenviar → aprobar → completar) sin errores.

### BUG-005 · Los mensajes de error de los formularios no se ocultaban al corregir
- **Detectado:** Fase 2, revisando capturas de pantalla.
- **Severidad:** Baja.
- **Cómo reproducir:** enviar el formulario de nueva solicitud vacío y después elegir un tipo de permiso → el error "Elegí un tipo de permiso" seguía visible.
- **Causa:** el mensaje solo se ocultaba al volver a enviar.
- **Solución:** los formularios ocultan su mensaje de error en cuanto el usuario edita (eventos `input` / `change`): login, nueva solicitud y, en el detalle, acciones, notas y adjuntos (`ocultarErrorAlEditar`).
- **Commit:** rama `fix/bugs-pre-fase-3`.
- **Test de regresión:** prueba en el navegador de los tres casos: login, nueva solicitud y comentario en el detalle.

### BUG-006 · Recargar los datos de prueba cerraba las sesiones abiertas
- **Detectado:** Fase 3, prueba de la matriz de campos (un `400` en `identitytoolkit.googleapis.com/v1/accounts:lookup`).
- **Severidad:** Baja (solo afecta a la demo, pero desloguea a cualquiera que la esté usando).
- **Cómo reproducir:** iniciar sesión en la app; correr `npm run seed`; recargar la página → la sesión se cierra y la consola muestra un `400` de `accounts:lookup`.
- **Causa:** `seed.mjs` hacía `updateUser({ password })` también sobre los usuarios que ya existían. Para Firebase, cambiar la contraseña (aunque sea la misma) invalida todas las sesiones de ese usuario. Al recargar, el SDK intenta validar la sesión vieja con `accounts:lookup`, recibe `400` y la cierra. **Es también la explicación del `400` aislado que se vio en la Fase 2**, que se había registrado como parte de BUG-004: esa prueba también se hizo justo después de recargar los datos.
- **Solución:** a los usuarios existentes ya no se les cambia la contraseña. Para restablecerla a propósito existe `npm run seed:restablecer-claves`.
- **Commit:** rama `fix/BUG-006-seed-cierra-sesiones`.
- **Test de regresión:** prueba en el navegador. Iniciar sesión → `npm run seed` → recargar la página: la sesión sigue abierta y no hay respuestas con error. Además, `npm test` (28 + 44) en verde.

### BUG-007 · Desbordes horizontales: columna de acciones del detalle y tablas en celulares
- **Detectado:** Fase 3, revisando una captura del detalle de una solicitud con acciones. Al medir se encontró una segunda manifestación.
- **Severidad:** Media (se ve mal y aparece scroll horizontal en toda la página).
- **Cómo reproducir:**
  1. Abrir el detalle de una solicitud con acciones en una ventana de 1024 a 1550 px: la columna derecha sobresale de la grilla (42 px a 1440 px). A 800 px, el selector de archivo genera scroll horizontal.
  2. Abrir el inicio en un celular (390 px): la página entera tiene scroll horizontal del doble del ancho, porque la tabla empuja.
- **Causa:** en CSS Grid, cada elemento tiene por defecto `min-width: auto`: no se achica por debajo del ancho mínimo de su contenido. El `<textarea>` y el `<input type="file">` tienen un ancho propio (~300 px) mayor que la columna de acciones (304 px de pista contra 297 px de contenido más el padding de la tarjeta), y la tabla es más ancha que un celular. Como `.columna`, `.formulario`, `.campo` y `.contenido` son grillas, el contenido empujaba hacia afuera.
- **Solución:** `min-width: 0` en los hijos de esas grillas (`.contenido > *`, `.columna`, `.columna > *`, `.formulario > *`, `.campo`, `.campo > *`) y `max-width: 100%` en `input[type="file"]`. La tabla conserva su propio scroll interno (`.tabla-contenedor`).
- **Commit:** rama `fix/BUG-007-desborde-columna-acciones`.
- **Test de regresión:** medición automática en el navegador del desborde de las tarjetas y del scroll horizontal de la página en 10 anchos (1550 → 320 px), para el detalle con acciones y para el inicio: todo en 0. En el celular, la tabla mantiene su scroll interno. `npm test` en verde.

### BUG-008 · El aviso de una acción seguía visible después de cerrar sesión
- **Detectado:** Fase 4, en la prueba integral automática. El aviso que se leyó después de dar de baja a un usuario era en realidad "SOL-0011: Completar gestión ✔", el aviso de la usuaria anterior.
- **Severidad:** Baja. Dura como mucho 4 segundos, pero en una computadora compartida quien entra después puede ver una acción de la sesión anterior.
- **Cómo reproducir:**
  1. Ejecutar una acción que muestre un aviso; por ejemplo, agregar una nota.
  2. Hacer clic en "Salir" antes de que pasen 4 segundos: el aviso sigue en la pantalla de login.
  3. Si otra persona inicia sesión enseguida, también lo ve.
- **Causa:** la zona de avisos (`#zonaAvisos`) se agrega directamente al `<body>`, fuera del contenedor que se redibuja en cada pantalla, para que un aviso sobreviva al cambio de pantalla. Cerrar sesión cambia la pantalla, pero no borraba los avisos pendientes.
- **Solución:** `limpiarAvisos()` en `src/ui/utils/avisos.js`, llamada desde `src/main.js` cuando el observador de la sesión informa que no hay usuario (al cerrar sesión o al rechazar una sesión).
- **Commit:** rama `fix/BUG-008-avisos-entre-sesiones`.
- **Test de regresión:** prueba automática en el navegador:
  - Ana agrega una nota y sale enseguida: la zona de avisos queda vacía en el login.
  - Al volver a entrar, un aviso nuevo se muestra normalmente.
  - `npm test` en verde (54 + 52).

---

## Observaciones (no son bugs de la app)

### OBS-001 · `400` en la consola al ingresar una contraseña incorrecta
Firebase Auth responde `400` a `accounts:signInWithPassword` cuando las credenciales son inválidas, y el navegador registra toda respuesta 4xx en la consola. Es el comportamiento esperado: la app lo traduce a "Email o contraseña incorrectos." y no se puede silenciar desde JavaScript.

En la Fase 4 aparece lo mismo en el alta de usuarios. `accounts:signUp` responde `400` cuando el email ya tiene cuenta. Si después la contraseña no coincide, `accounts:signInWithPassword` también responde `400`. La app traduce los dos casos a "Ya existe una cuenta de acceso con ese email." o completa el alta interrumpida.

### OBS-002 · `Listen/channel ERR_ABORTED` al cerrar sesión
Al cambiar de usuario, el SDK de Firestore cierra y vuelve a abrir su conexión interna (`google.firestore.v1.Firestore/Listen/channel`). El navegador muestra las peticiones cortadas como abortadas. Es interno del SDK y no afecta los datos.

### OBS-003 · El navegador muestra una versión vieja de la app después de un cambio
Los navegadores guardan en caché los módulos JavaScript. En desarrollo: Live Server recarga solo al guardar; si no, recargar con **Ctrl + F5**. En producción: verificar en la Fase 6 que Vercel sirva los archivos con revalidación (`Cache-Control: max-age=0, must-revalidate`).

### OBS-004 · (Entorno) git no podía autenticarse con GitHub
La configuración global de git (`~/.gitconfig`) apuntaba a un `gh.exe` que ya no existía (carpeta temporal de otro proyecto). Se resolvió en la Fase 1 con `gh auth login` y `gh auth setup-git`.

### OBS-005 · (Proceso) Un script temporal de pruebas se subió a `main`
Al integrar la corrección del BUG-008, `git add -A` incluyó `scripts/tmp-prueba-fase4.mjs`, un script temporal que prepara escenarios de prueba con `firebase-admin`. La regla `scripts/tmp-*` del `.gitignore` se había agregado en la rama de la Fase 4, que todavía no estaba en `main`, así que en la rama `fix/` el archivo no estaba ignorado. El `git status` previo al commit lo mostraba (`A scripts/tmp-prueba-fase4.mjs`) y no se frenó.
- **Impacto:** el script **no contiene la clave de servicio** (solo la lee de `scripts/serviceAccountKey.json`, que sigue ignorado y nunca se subió; se verificó con `git grep` que el repositorio no tiene claves privadas). Contiene emails de prueba y la contraseña inicial de cuentas de prueba que se borran al cerrar la fase.
- **Corrección:** rama `fix/quitar-script-temporal`: `git rm --cached` (el archivo sigue en el disco) y la regla `scripts/tmp-*` en el `.gitignore` de `main`. No se reescribió el historial, porque no hay ningún secreto que borrar.
- **Lección:**
  - Antes de cada commit, revisar la lista de `git status` buscando archivos inesperados, sobre todo después de cambiar de rama.
  - Las reglas del `.gitignore` que protegen archivos locales tienen que estar en `main`, no solo en una rama de trabajo.
