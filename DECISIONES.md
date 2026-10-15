# Decisiones técnicas

Registro de las decisiones importantes del proyecto: qué decidimos, qué alternativas consideramos y por qué. El paso a paso de la construcción está en `BITACORA.md`.

---

## 1. Arquitectura en capas sin framework

- **Decisión:** JavaScript vanilla organizado en capas: `ui/` (pantallas) → `services/` (reglas de negocio) → `data/` (repositorios de Firebase) → `config/` (configuración y constantes). La UI nunca importa Firebase.
- **Alternativas:** React/Vue/Angular; todo el código en las pantallas.
- **Por qué:** lo pide la prueba (vanilla y en capas) y deja cada responsabilidad en un solo lugar. Si cambia la base de datos se toca solo `data/`; si cambia una regla de negocio, solo `services/`. Además, cada capa se puede explicar y probar por separado.

## 2. SDK de Firebase por CDN, sin bundler, versión fija 12.19.0

- **Decisión:** importar el SDK modular desde `https://www.gstatic.com/firebasejs/12.19.0/...`. `src/config/firebase.js` es el único archivo que conoce esa URL y reexporta las funciones que usa la app.
- **Alternativas:** `npm` + Vite/Webpack; la versión 13.0.0 recién publicada.
- **Por qué:**
  - El sitio queda 100 % estático (se publica tal cual en Vercel, sin paso de build).
  - Reexportar desde un único archivo hace que actualizar la versión sea cambiar una sola URL.
  - La 13.0.0 era un cambio de versión mayor con una semana de vida; la 12.19.0 es estable.

## 3. Router por hash (SPA)

- **Decisión:** una sola página (`index.html`) y un router que dibuja la pantalla según el hash (`#/login`, `#/inicio`).
- **Alternativas:** un HTML por pantalla; History API (`/inicio`) con reescrituras en el servidor.
- **Por qué:** cambiar el hash no recarga la página ni requiere configurar el servidor, así que funciona igual con Live Server y con Vercel. La protección de rutas es solo de navegación: la seguridad real está en las reglas.

## 4. El rol vive en el documento `usuarios/{uid}` y las reglas lo leen con `get()`

- **Decisión:** el perfil (rol, activo, supervisor) está en Firestore y `firestore.rules` lo consulta en cada petición.
- **Alternativas:** *custom claims* de Firebase Auth (el rol viaja dentro del token).
- **Por qué:** los custom claims solo se pueden asignar con el Admin SDK, es decir, con un servidor o Cloud Functions, que requieren el plan Blaze. Además, el token tarda hasta una hora en refrescarse. Con el documento, el admin cambia un rol o da de baja a alguien desde la app y el efecto es inmediato. El costo es una lectura extra por petición, que Firestore cachea dentro de la misma petición.

## 5. Etapa y estado separados

- **Decisión:** cada solicitud tiene `etapaActual` (solicitud, aprobación, gestión RH, finalizada) y `estadoActual` (enAprobacion, devuelta, enGestionRh, completada, rechazada, cancelada).
- **Alternativas:** un único campo de estado.
- **Por qué:** el reporte pedido es "distribución por **etapa**", pero el usuario necesita saber qué pasó exactamente: "rechazada" y "completada" son la misma etapa (finalizada) con resultados opuestos.

## 6. Tabla de transiciones centralizada y replicada en las reglas

- **Decisión:** `TRANSICIONES` en `src/config/constantes.js` define cada acción: estados de origen, estado y etapa nuevos, rol requerido, si la ejecuta el asignado o el solicitante, y si exige comentario. `firestore.rules` replica la misma tabla.
- **Alternativas:** validar en cada pantalla o en cada función del servicio con `if` sueltos.
- **Por qué:** es una sola fuente de verdad para el flujo. La usan el servicio y el script de datos de prueba, que valida cada guion contra ella. Las reglas no pueden importar JavaScript, por eso la tabla se copia (y hay un aviso en ambos archivos).

## 7. Datos desnormalizados para la bandeja y los reportes

- **Decisión:** la solicitud guarda copias (`solicitanteNombre`, `asignadoNombre`) y campos pensados para consultar: `asignadoA`, `participantes`, `vistaPorAsignado`, `cantidadAdjuntos`, `cantidadNotas`.
- **Alternativas:** guardar solo ids y buscar cada usuario al mostrar.
- **Por qué:** Firestore no tiene JOIN. Sin la copia, una bandeja de 50 filas haría 50 lecturas extra. Cada pestaña se resuelve con una sola consulta: Pendientes (`asignadoA == yo`), Nuevas (`… && vistaPorAsignado == false`) y Enviadas (`participantes array-contains yo`). El costo es que, si alguien cambia de nombre, los trámites viejos conservan el nombre anterior, que es lo correcto para un registro histórico.

## 8. La tarea siempre se asigna a un usuario concreto (corregida en la Fase 2)

- **Decisión:** `asignadoA` es siempre un uid. En la etapa RH se usa un **reparto rotativo**: los usuarios RH activos se ordenan por nombre y la solicitud `SOL-N` va al que está en la posición `N % cantidad de RH`.
- **Alternativas:**
  - Asignar a una "cola" del rol RH, de la que cualquier RH toma la tarea.
  - "El RH con menos pendientes" (era la decisión original de la Fase 1).
- **Por qué:**
  - Un responsable concreto permite el reporte "carga de tareas pendientes por usuario" con una consulta simple.
  - **Corrección:** "el RH con menos pendientes" no se puede implementar sin abrir permisos. Para contar las tareas de cada RH, el supervisor que aprueba tendría que leer solicitudes que no le pertenecen, y las reglas lo impiden (las reglas no son filtros).
  - El reparto rotativo distribuye parejo, no necesita lecturas extra y no debilita la seguridad.

## 9. Historial append-only, en subcolección, con hora del servidor

- **Decisión:** `solicitudes/{id}/historial`. Las reglas permiten crear eventos pero nunca editarlos ni borrarlos. Cada evento debe estar firmado por quien lo escribe (`usuarioId == request.auth.uid`), con `fecha == request.time` (`serverTimestamp()`) y ser coherente con el cambio real de la solicitud (`getAfter`). Las notas son eventos (`notaAgregada`).
- **Alternativas:** un array de eventos dentro de la solicitud; una colección separada para las notas.
- **Por qué:** es la trazabilidad pedida ("quién hizo qué y cuándo") y nadie puede reescribirla. La subcolección no tiene el límite de 1 MiB del documento y no se descarga al listar la bandeja. Tener una sola línea de tiempo simplifica la vista del trámite.
- **Ampliado en la Fase 2 (trazabilidad en las dos direcciones):** la solicitud tiene `ultimoEventoId`. Las reglas exigen que todo cambio (estado, nota, adjunto, corrección de datos) apunte a un evento **creado en el mismo lote** (`existsAfter` y `!exists`). Además, cada evento tiene que ser el último de la solicitud y coincidir con lo que cambió: un cambio de estado no se puede registrar como "nota". La única excepción es marcar la solicitud como vista, que no es una acción sobre el trámite.

## 10. Escrituras atómicas con `writeBatch`

- **Decisión:** el cambio de una solicitud, su evento de historial y su adjunto (si lo hay) se guardan en un mismo lote.
- **Alternativas:** escrituras sueltas una después de otra.
- **Por qué:** o se guarda todo o no se guarda nada; nunca queda una solicitud aprobada sin su registro en el historial. Además, las reglas evalúan el lote completo, y por eso pueden comparar el evento con la solicitud.

## 11. Adjuntos en Firestore como base64, máximo 600 KB

- **Decisión:** cada archivo es un documento en `solicitudes/{id}/adjuntos` con su contenido en base64. Solo PDF, JPG y PNG. Máximo **600 KB por archivo**, validado en el servicio (mensaje claro) y en `firestore.rules` (seguridad).
- **Alternativas:** Firebase Storage.
- **Por qué:**
  - Storage hoy exige el plan Blaze (requiere tarjeta), y el proyecto se mantiene en el plan gratuito Spark.
  - **Cuentas del límite:** un documento admite como máximo 1 MiB (1.048.576 bytes), y el base64 agranda el archivo ~33% (4 caracteres por cada 3 bytes). 600 KB = 614.400 bytes, que en base64 son 819.200 caracteres; quedan ~229 KB de margen para los demás campos.
  - Los adjuntos van en una subcolección para que listar solicitudes no descargue archivos.
  - **Costo aceptado:** no sirve para archivos grandes. Para un certificado o una constancia alcanza.

## 12. Tipos de permiso como constantes

- **Decisión:** `CONFIG_TIPOS_PERMISO` en `constantes.js` (nombre, si requiere adjunto, días máximos), replicado en las reglas.
- **Alternativas:** una colección `tiposPermiso` editable desde la app.
- **Por qué:** son reglas de negocio que también validan las reglas de seguridad, y estas no pueden leer configuración dinámica de forma práctica. Hacerlos editables queda como mejora futura.

## 13. Baja lógica de usuarios

- **Decisión:** dar de baja es `activo: false`. Las reglas prohíben borrar usuarios y exigen `activo == true` para operar. El servicio de login rechaza a los inactivos y corta las sesiones recordadas.
- **Alternativas:** borrar la cuenta de Auth y el perfil.
- **Por qué:** desde el navegador no se pueden borrar cuentas de otros usuarios en Auth (requiere Admin SDK). Además, borrar dejaría trámites e historial apuntando a alguien inexistente.

## 14. Alta de usuarios desde la app con una segunda instancia de Firebase App (se implementa en la Fase 4)

- **Problema:** con el SDK de cliente, `createUserWithEmailAndPassword` deja logueado al usuario recién creado y saca al admin de su sesión. Cloud Functions y el Admin SDK lo resolverían del lado del servidor, pero requieren el plan Blaze.
- **Decisión:** crear una segunda instancia de Firebase App, solo para dar de alta usuarios:
  ```js
  const appSecundaria = initializeApp(firebaseConfig, 'altaUsuarios');
  const authSecundaria = initializeAuth(appSecundaria, { persistence: inMemoryPersistence });
  const credencial = await createUserWithEmailAndPassword(authSecundaria, email, passwordTemporal);
  await signOut(authSecundaria);
  // El admin sigue logueado en la instancia principal y escribe el perfil:
  await setDoc(doc(db, 'usuarios', credencial.user.uid), { /* nombre, rol, activo… */ });
  ```
  Cada instancia tiene su propia sesión de Auth, así que la del admin no se toca. `inMemoryPersistence` evita que la sesión secundaria se guarde en el navegador.
- **Seguridad:**
  - El perfil lo escribe el admin con su sesión, y las reglas solo permiten escribir en `usuarios` a un admin.
  - Si la escritura del perfil falla, la cuenta de Auth queda sin perfil y no puede hacer nada, porque las reglas exigen un perfil activo. El servicio permite reintentar el alta.
- **Límites aceptados:**
  - El email no se edita después del alta.
  - El cambio de contraseña es por `sendPasswordResetEmail`.
  - La baja es lógica (decisión 13).
- **Alternativas descartadas:**
  - Cloud Functions / Admin SDK: requieren Blaze.
  - Que el admin se vuelva a loguear después de cada alta: mala experiencia.
  - Registro libre con aprobación posterior: no hay control de quién se registra.

## 15. Datos de prueba con firebase-admin y guiones validados

- **Decisión:** `scripts/seed.mjs` (Node + firebase-admin, con la clave de cuenta de servicio ignorada por git) carga usuarios, roles y 10 solicitudes. Cada solicitud es un guion de acciones que se recorre con `TRANSICIONES`. Es idempotente y tiene un modo `--simular`.
- **Alternativas:** cargar los datos a mano en la consola; un JSON fijo con el historial escrito a mano.
- **Por qué:** es reproducible, y el historial queda coherente por construcción: si un guion tuviera un paso imposible, el script falla. El Admin SDK es la única forma de crear usuarios de Auth con contraseña desde un script.

## 16. Tests automáticos de las reglas con el emulador

- **Decisión:** `scripts/tests/reglas.test.mjs` (30 casos) con `@firebase/rules-unit-testing` y el runner nativo `node:test`, contra el emulador de Firestore con un proyecto `demo-…`.
- **Alternativas:** probar solo a mano con el Rules Playground de la consola.
- **Por qué:** las reglas son la parte más crítica de la seguridad, y un error puede compilar bien. De hecho, los tests detectaron una condición invertida que bloqueaba aprobar y devolver. El proyecto `demo-…` garantiza que nunca se toca la base real. Con `node:test` no hace falta sumar Jest ni Mocha.

## 17. El propio perfil se puede leer aunque el usuario esté inactivo

- **Decisión:** la regla `allow get` de `usuarios/{uid}` permite leer el propio documento sin exigir `activo == true`. El resto de los datos sí lo exige.
- **Alternativas:** bloquear toda lectura a los inactivos.
- **Por qué:** así el login puede decir claramente "tu usuario está dado de baja" en lugar de un error genérico de permisos. El perfil propio no expone información de terceros.

## 18. Número correlativo con un contador y una transacción

- **Decisión:** el documento `contadores/solicitudes` guarda `ultimoNumero`. Al crear una solicitud, una **transacción** lee el contador, lo incrementa y escribe todo junto. Las reglas exigen que suba exactamente 1 y que el `numero` (`SOL-0011`) coincida.
- **Alternativas:**
  - Usar el id automático de Firestore como número: no es legible.
  - Contar las solicitudes existentes y sumar 1: dos personas creando a la vez obtendrían el mismo número.
  - Un número aleatorio: no es correlativo.
- **Por qué:** la transacción garantiza que lo que se leyó no cambió al escribir. Si otro creó una solicitud en el medio, Firestore reintenta, así que el número nunca se repite.
- **Costo aceptado:** todas las creaciones pasan por un mismo documento. Firestore admite del orden de una escritura por segundo sostenida por documento, sobrado para el volumen de una empresa. Un usuario malintencionado podría incrementar el contador sin crear una solicitud; solo genera un salto en la numeración.

## 19. Lógica del flujo en un módulo puro compartido

- **Decisión:** `src/services/flujoSolicitud.js` interpreta la tabla de transiciones (acciones disponibles, cambios de cada acción, asignación, validaciones) sin usar Firebase, el DOM ni el reloj. Lo usan el servicio de la app y el script de datos de prueba.
- **Alternativas:** escribir la lógica dentro del servicio, mezclada con las llamadas a Firestore; que el seed tenga su propia copia.
- **Por qué:** se testea en milisegundos con `node:test` (28 tests) sin emulador ni navegador. Además, la app y los datos de prueba no pueden "pensar distinto" sobre el flujo, y el servicio queda corto: solo orquesta.

## 20. Escrituras en transacción con una función "armar" del servicio

- **Decisión:** el repositorio expone `crearConNumero(armar)` y `actualizarConEvento(id, armar)`. Abre una transacción, lee el dato fresco (contador o solicitud) y llama a `armar`, que pertenece al servicio y decide qué escribir. El repositorio agrega ids, `serverTimestamp()` y el enlace `ultimoEventoId`.
- **Alternativas:** que el servicio arme el lote con datos leídos antes (pueden estar desactualizados); que el repositorio conozca las reglas del flujo.
- **Por qué:** cada acción se valida contra el estado real en el momento de escribir. Si dos personas actúan a la vez, la segunda recibe un error claro en lugar de pisar el trabajo de la primera. Además, cada capa conserva una sola responsabilidad.

## 21. Un único mensaje para "no existe" y "no tenés permiso"

- **Decisión:** al abrir una solicitud inexistente o ajena se muestra "La solicitud no existe o no tenés permiso para verla".
- **Alternativas:** mensajes distintos para cada caso.
- **Por qué:** Firestore responde igual en los dos casos (las reglas rechazan leer un documento inexistente). Distinguirlos revelaría qué ids existen.
