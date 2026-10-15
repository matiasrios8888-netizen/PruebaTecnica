# Modelo de datos (Firestore)

Firestore es una base de datos **NoSQL de documentos**: los datos se guardan en *colecciones*, cada una con *documentos* (objetos JSON con un id), y un documento puede tener *subcolecciones*.

Convenciones del proyecto:
- Campos en **camelCase y en español** (`fechaInicio`, `estadoActual`, `asignadoA`).
- Los valores posibles de roles, etapas, estados, tipos de permiso y acciones están definidos **una sola vez** en [`src/config/constantes.js`](../src/config/constantes.js).
- Los tipos JSDoc (`@typedef`) de cada entidad están en [`src/data/modelos.js`](../src/data/modelos.js).
- `Timestamp` = fecha y hora de Firestore. Las fechas de auditoría las pone el servidor (`serverTimestamp()`), nunca el reloj del navegador.

```
usuarios/{uid}
roles/{clave}
contadores/solicitudes
solicitudes/{id}
  ├── historial/{eventoId}
  └── adjuntos/{adjuntoId}
```

---

## 1. `usuarios/{uid}`

Perfil de cada persona. El **id del documento es el uid de Firebase Authentication**, así se relaciona la cuenta de login con su perfil sin buscar.

| Campo | Tipo | Descripción |
|---|---|---|
| `nombre` | string | Nombre y apellido para mostrar. |
| `email` | string | Email de login. No se edita después del alta (debe coincidir con Auth). |
| `rol` | string | `iniciador` \| `supervisor` \| `rh` \| `admin`. |
| `supervisorId` | string \| null | uid del supervisor que aprueba sus solicitudes. |
| `area` | string | Área o sector. |
| `activo` | boolean | `false` = baja lógica: no puede iniciar sesión ni operar. |
| `fechaCreacion` | Timestamp | |
| `fechaActualizacion` | Timestamp | |

```json
{
  "nombre": "Ana Gómez",
  "email": "iniciador@bprosys.test",
  "rol": "iniciador",
  "supervisorId": "uidSupervisor",
  "area": "Operaciones",
  "activo": true,
  "fechaCreacion": "<Timestamp>",
  "fechaActualizacion": "<Timestamp>"
}
```

## 2. `roles/{clave}`

Catálogo de roles para la gestión de roles (Fase 4). El id del documento es la clave del rol (`iniciador`, `supervisor`, `rh`, `admin`).

| Campo | Tipo | Descripción |
|---|---|---|
| `nombre` | string | Nombre para mostrar. |
| `descripcion` | string | Qué hace el rol en el flujo. |
| `permisos` | string[] | Capacidades del rol (ver `PERMISOS` en constantes). |
| `activo` | boolean | |

```json
{
  "nombre": "Supervisor",
  "descripcion": "Aprueba, devuelve o rechaza las solicitudes de su equipo",
  "permisos": ["solicitud.aprobar", "solicitud.devolver", "solicitud.rechazar"],
  "activo": true
}
```

## 2.b `contadores/solicitudes`

Último número correlativo usado. Al crear una solicitud, la app lee el contador, le suma 1 y guarda en una misma **transacción** el contador, la solicitud (con `numero: "SOL-0011"`), su evento `creada` y sus adjuntos. Si dos personas crean al mismo tiempo, Firestore reintenta una de las transacciones, así que el número nunca se repite. Las reglas exigen que el contador suba exactamente 1 y que el `numero` coincida (4 dígitos, hasta `SOL-9999`).

| Campo | Tipo | Descripción |
|---|---|---|
| `ultimoNumero` | number | Último número asignado. Lo inicializa el script de datos de prueba. |

```json
{ "ultimoNumero": 10 }
```

## 3. Tipos de permiso (no es una colección)

Viven en `CONFIG_TIPOS_PERMISO` dentro de `constantes.js` porque son reglas de negocio fijas.

| Clave | Nombre | Requiere adjunto | Días máximos |
|---|---|---|---|
| `vacaciones` | Vacaciones | No | 15 |
| `enfermedad` | Enfermedad | Sí | 30 |
| `personal` | Asunto personal | No | 2 |
| `estudio` | Estudio / examen | Sí | 5 |
| `duelo` | Duelo | Sí | 5 |
| `maternidadPaternidad` | Maternidad / paternidad | Sí | 90 |

## 4. `solicitudes/{id}`

El trámite. Algunos datos están **desnormalizados** (copiados), como `solicitanteNombre` o `asignadoNombre`. Firestore no tiene JOIN, y sin esa copia la bandeja necesitaría una lectura extra por cada fila.

| Campo | Tipo | Descripción |
|---|---|---|
| `numero` | string | Número legible para buscar (`SOL-0001`). |
| `tipoPermiso` | string | Clave del tipo de permiso. |
| `fechaInicio` | string `AAAA-MM-DD` | Primer día del permiso. |
| `fechaFin` | string `AAAA-MM-DD` | Último día del permiso. |
| `cantidadDias` | number | Días corridos, inclusive. |
| `motivo` | string | Explicación del colaborador. |
| `solicitanteId` | string | uid de quien la creó. |
| `solicitanteNombre` | string | Copia del nombre. |
| `supervisorId` | string | Supervisor del solicitante al crearla. |
| `etapaActual` | string | `solicitud` \| `aprobacion` \| `gestionRh` \| `finalizada`. |
| `estadoActual` | string | `enAprobacion` \| `devuelta` \| `enGestionRh` \| `completada` \| `rechazada` \| `cancelada`. |
| `asignadoA` | string \| null | uid de quien tiene que actuar ahora. `null` si está finalizada. |
| `asignadoNombre` | string \| null | Copia del nombre del asignado. |
| `rolAsignado` | string \| null | Rol con el que actúa el asignado. |
| `vistaPorAsignado` | boolean | `false` = el asignado todavía no la abrió (pestaña **Nuevas**). |
| `participantes` | string[] | uids de todos los que intervinieron (pestaña **Enviadas**). |
| `cantidadAdjuntos` | number | Contador para mostrar en la bandeja sin leer la subcolección. |
| `cantidadNotas` | number | Ídem para notas. |
| `referenciaRh` | string \| null | **Gestión RH:** número de registro en liquidación (1 a 40 caracteres). Nace en `null`; lo carga solo el RH asignado al completar (obligatorio para completar). |
| `diasDescontados` | number \| null | **Gestión RH:** días descontados del saldo (0 a `cantidadDias`). Nace en `null`; lo carga solo el RH asignado al completar. |
| `ultimoEventoId` | string | Id del último evento del historial. Todo cambio (salvo marcarla como vista) debe apuntar a un evento creado en el mismo lote. |
| `fechaCreacion` | Timestamp | |
| `fechaActualizacion` | Timestamp | Se usa para ordenar la bandeja. |

```json
{
  "numero": "SOL-0001",
  "tipoPermiso": "vacaciones",
  "fechaInicio": "2026-11-03",
  "fechaFin": "2026-11-07",
  "cantidadDias": 5,
  "motivo": "Viaje familiar",
  "solicitanteId": "uidIniciador",
  "solicitanteNombre": "Ana Gómez",
  "supervisorId": "uidSupervisor",
  "etapaActual": "aprobacion",
  "estadoActual": "enAprobacion",
  "asignadoA": "uidSupervisor",
  "asignadoNombre": "Carlos Pérez",
  "rolAsignado": "supervisor",
  "vistaPorAsignado": false,
  "participantes": ["uidIniciador", "uidSupervisor"],
  "cantidadAdjuntos": 0,
  "cantidadNotas": 0,
  "referenciaRh": null,
  "diasDescontados": null,
  "ultimoEventoId": "Xb3kP9qL2mN7",
  "fechaCreacion": "<Timestamp>",
  "fechaActualizacion": "<Timestamp>"
}
```

### Flujo de estados

| Acción | Desde | Hacia (estado / etapa) | Quién |
|---|---|---|---|
| crear | — | `enAprobacion` / `aprobacion` | iniciador (solicitante) |
| aprobar | `enAprobacion` | `enGestionRh` / `gestionRh` | supervisor asignado |
| devolver | `enAprobacion` | `devuelta` / `solicitud` | supervisor asignado (comentario obligatorio) |
| reenviar | `devuelta` | `enAprobacion` / `aprobacion` | iniciador (solicitante) |
| rechazar | `enAprobacion` | `rechazada` / `finalizada` | supervisor asignado (comentario obligatorio) |
| completar | `enGestionRh` | `completada` / `finalizada` | RH asignado |
| rechazarRh | `enGestionRh` | `rechazada` / `finalizada` | RH asignado (comentario obligatorio) |
| cancelar | `enAprobacion`, `devuelta` | `cancelada` / `finalizada` | iniciador (solicitante) |

Asignación:
- Al crear o reenviar → el supervisor del solicitante.
- Al aprobar → un usuario RH activo, por **reparto rotativo** según el número: los RH activos se ordenan y se toma el que está en la posición `número % cantidad de RH`.
- Al devolver → el solicitante.
- En los estados finales → `null`.

### Control de campos por rol (`MATRIZ_CAMPOS` en `constantes.js`)

| Campo | Quién lo edita (y con qué acción se guarda) | Quién lo ve |
|---|---|---|
| `tipoPermiso`, `fechaInicio`, `fechaFin`, `motivo` | El solicitante, con la solicitud **devuelta** (se guarda al *reenviar*) | Todos los que pueden abrir la solicitud |
| `referenciaRh`, `diasDescontados` | El RH **asignado**, en **gestión RH** (se guarda al *completar*) | RH y admin en gestión RH y completada; **todos** una vez completada |

La pantalla de detalle se dibuja con `accesoACampos()` (editable / lectura / oculto) y `firestore.rules` exige la misma regla de **edición**. Firestore no puede ocultar campos sueltos de un documento: la visibilidad es de la interfaz. Por eso estos campos no guardan datos sensibles.

**Trazabilidad en las dos direcciones:** todo cambio de la solicitud (estado, nota, adjunto, datos) apunta en `ultimoEventoId` a un evento creado en el mismo lote, y cada evento tiene que coincidir con el cambio real de la solicitud. La única excepción es marcarla como vista (`vistaPorAsignado`), que no es una acción sobre el trámite.

## 5. `solicitudes/{id}/historial/{eventoId}`

**Trazabilidad**: quién hizo qué y cuándo. Es *append-only*, es decir que las reglas de seguridad permiten crear eventos pero nunca editarlos ni borrarlos. Las notas del trámite también son eventos (`accion: "notaAgregada"`), así hay una sola línea de tiempo.

| Campo | Tipo | Descripción |
|---|---|---|
| `accion` | string | `creada`, `aprobada`, `devuelta`, `reenviada`, `rechazada`, `completada`, `cancelada`, `notaAgregada`, `adjuntoAgregado`. |
| `usuarioId` | string | uid de quien actuó (debe ser el usuario logueado). |
| `usuarioNombre` | string | Copia del nombre. |
| `rolUsuario` | string | Rol que tenía en ese momento. |
| `fecha` | Timestamp | Fecha del servidor. |
| `estadoAnterior` / `estadoNuevo` | string \| null | `null` si la acción no cambia el estado (nota, adjunto). |
| `etapaAnterior` / `etapaNueva` | string \| null | Ídem. |
| `comentario` | string | Motivo o texto de la nota (`""` si no hay). |

```json
{
  "accion": "aprobada",
  "usuarioId": "uidSupervisor",
  "usuarioNombre": "Carlos Pérez",
  "rolUsuario": "supervisor",
  "fecha": "<Timestamp>",
  "estadoAnterior": "enAprobacion",
  "estadoNuevo": "enGestionRh",
  "etapaAnterior": "aprobacion",
  "etapaNueva": "gestionRh",
  "comentario": "Aprobado, coordinar cobertura"
}
```

## 6. `solicitudes/{id}/adjuntos/{adjuntoId}`

Archivos guardados en **base64** dentro de Firestore (sin Firebase Storage, para usar el plan gratuito Spark). Están en una subcolección porque leer un documento no trae sus subcolecciones, así que listar solicitudes no descarga archivos.

| Campo | Tipo | Descripción |
|---|---|---|
| `nombreArchivo` | string | |
| `tipoMime` | string | `application/pdf`, `image/jpeg` o `image/png`. |
| `tamanoBytes` | number | Tamaño original, máximo 614.400 (600 KB). |
| `contenidoBase64` | string | Máximo 819.200 caracteres. |
| `subidoPor` | string | uid. |
| `subidoPorNombre` | string | |
| `fechaSubida` | Timestamp | |

```json
{
  "nombreArchivo": "certificado.pdf",
  "tipoMime": "application/pdf",
  "tamanoBytes": 182340,
  "contenidoBase64": "JVBERi0xLjQK...",
  "subidoPor": "uidIniciador",
  "subidoPorNombre": "Ana Gómez",
  "fechaSubida": "<Timestamp>"
}
```

**Por qué 600 KB:** un documento de Firestore admite como máximo 1 MiB (1.048.576 bytes), y el base64 agranda el archivo ~33%. 600 KB en base64 ocupan 819.200 caracteres, lo que deja ~229 KB de margen para los demás campos. El límite se valida en el servicio (mensaje claro al usuario) y en `firestore.rules` (seguridad en el servidor).
