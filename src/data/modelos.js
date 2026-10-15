/**
 * =============================================================
 * Capa: DATOS (definiciones de tipos)
 * Archivo: src/data/modelos.js
 *
 * Responsabilidad:
 *   Documentar con @typedef de JSDoc la forma de cada entidad que se guarda
 *   en Firestore. No contiene lógica: sirve para que el editor autocomplete
 *   y para que quien lea el código sepa qué campos tiene cada objeto.
 *   Detalle completo de colecciones en docs/MODELO_DATOS.md.
 *
 * Depende de: src/config/constantes.js (los valores posibles de rol, estado,
 *   etapa, tipo de permiso y acción salen de ahí).
 *
 * Convención: campos en camelCase y en español. Las fechas son Timestamp de
 *   Firestore, salvo fechaInicio/fechaFin de la solicitud, que son días
 *   calendario ("AAAA-MM-DD") y no necesitan hora ni zona horaria.
 * =============================================================
 */

/**
 * Timestamp de Firestore (fecha y hora con precisión de nanosegundos).
 * @typedef {import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js').Timestamp} Timestamp
 */

/**
 * Usuario de la empresa. Colección "usuarios"; el id del documento es el uid de Firebase Auth.
 * @typedef {Object} Usuario
 * @property {string} id - uid de Firebase Auth (es el id del documento, no un campo guardado).
 * @property {string} nombre - Nombre y apellido para mostrar.
 * @property {string} email - Email con el que inicia sesión. No se edita después del alta.
 * @property {'iniciador'|'supervisor'|'rh'|'admin'} rol - Clave del rol (ver ROLES).
 * @property {string|null} supervisorId - uid del supervisor que aprueba sus solicitudes (null si no corresponde).
 * @property {string} area - Área o sector de la empresa.
 * @property {boolean} activo - false = baja lógica: no puede iniciar sesión ni operar.
 * @property {Timestamp} fechaCreacion
 * @property {Timestamp} fechaActualizacion
 * @example
 * {
 *   "nombre": "Ana Gómez",
 *   "email": "iniciador@bprosys.test",
 *   "rol": "iniciador",
 *   "supervisorId": "uidSupervisor",
 *   "area": "Operaciones",
 *   "activo": true,
 *   "fechaCreacion": "<Timestamp>",
 *   "fechaActualizacion": "<Timestamp>"
 * }
 */

/**
 * Rol del sistema. Colección "roles"; el id del documento es la clave del rol.
 * @typedef {Object} Rol
 * @property {string} id - Clave del rol (ej: "supervisor").
 * @property {string} nombre - Nombre para mostrar.
 * @property {string} descripcion - Qué hace este rol en el flujo.
 * @property {string[]} permisos - Capacidades del rol (ver PERMISOS).
 * @property {boolean} activo
 * @example
 * {
 *   "nombre": "Supervisor",
 *   "descripcion": "Aprueba, devuelve o rechaza las solicitudes de su equipo",
 *   "permisos": ["solicitud.aprobar", "solicitud.devolver", "solicitud.rechazar"],
 *   "activo": true
 * }
 */

/**
 * Configuración de un tipo de permiso. No es una colección: vive en
 * CONFIG_TIPOS_PERMISO (src/config/constantes.js).
 * @typedef {Object} TipoPermiso
 * @property {string} nombre - Nombre para mostrar.
 * @property {boolean} requiereAdjunto - Si exige al menos un archivo adjunto.
 * @property {number} diasMaximos - Tope de días por solicitud.
 * @example
 * { "nombre": "Enfermedad", "requiereAdjunto": true, "diasMaximos": 30 }
 */

/**
 * Solicitud de permiso (el "trámite"). Colección "solicitudes".
 * Los nombres se copian (desnormalizan) para que la bandeja y los reportes
 * no tengan que leer un usuario por cada fila.
 * @typedef {Object} Solicitud
 * @property {string} id - Id del documento.
 * @property {string} numero - Número legible para buscar (ej: "SOL-0001").
 * @property {string} tipoPermiso - Clave del tipo (ver TIPOS_PERMISO).
 * @property {string} fechaInicio - Primer día del permiso ("AAAA-MM-DD").
 * @property {string} fechaFin - Último día del permiso ("AAAA-MM-DD").
 * @property {number} cantidadDias - Días corridos entre fechaInicio y fechaFin, inclusive.
 * @property {string} motivo - Explicación del colaborador.
 * @property {string} solicitanteId - uid de quien creó la solicitud.
 * @property {string} solicitanteNombre
 * @property {string} supervisorId - uid del supervisor del solicitante al momento de crearla.
 * @property {string} etapaActual - Ver ETAPAS.
 * @property {string} estadoActual - Ver ESTADOS.
 * @property {string|null} asignadoA - uid de quien tiene que actuar ahora (null si está finalizada).
 * @property {string|null} asignadoNombre
 * @property {string|null} rolAsignado - Rol con el que actúa el asignado.
 * @property {boolean} vistaPorAsignado - false = el asignado todavía no la abrió (pestaña "Nuevas").
 * @property {string[]} participantes - uids de todos los que intervinieron (pestaña "Enviadas").
 * @property {number} cantidadAdjuntos
 * @property {number} cantidadNotas
 * @property {string|null} referenciaRh - Gestión RH: número de registro en liquidación. Nace en null
 *   y solo lo carga el RH asignado al completar (MATRIZ_CAMPOS).
 * @property {number|null} diasDescontados - Gestión RH: días descontados del saldo (0 a cantidadDias).
 *   Nace en null y solo lo carga el RH asignado al completar.
 * @property {string} ultimoEventoId - 📝 Id del último evento del historial. Todo cambio de la
 *   solicitud (salvo marcarla como vista) debe apuntar a un evento nuevo creado en el mismo
 *   lote; firestore.rules lo verifica.
 * @property {Timestamp} fechaCreacion
 * @property {Timestamp} fechaActualizacion
 * @example
 * {
 *   "numero": "SOL-0001",
 *   "tipoPermiso": "vacaciones",
 *   "fechaInicio": "2026-11-03",
 *   "fechaFin": "2026-11-07",
 *   "cantidadDias": 5,
 *   "motivo": "Viaje familiar",
 *   "solicitanteId": "uidIniciador",
 *   "solicitanteNombre": "Ana Gómez",
 *   "supervisorId": "uidSupervisor",
 *   "etapaActual": "aprobacion",
 *   "estadoActual": "enAprobacion",
 *   "asignadoA": "uidSupervisor",
 *   "asignadoNombre": "Carlos Pérez",
 *   "rolAsignado": "supervisor",
 *   "vistaPorAsignado": false,
 *   "participantes": ["uidIniciador", "uidSupervisor"],
 *   "cantidadAdjuntos": 0,
 *   "cantidadNotas": 0,
 *   "referenciaRh": null,
 *   "diasDescontados": null,
 *   "ultimoEventoId": "Xb3kP9qL2mN7",
 *   "fechaCreacion": "<Timestamp>",
 *   "fechaActualizacion": "<Timestamp>"
 * }
 */

/**
 * Contador para la numeración correlativa. Colección "contadores".
 * El documento "solicitudes" guarda el último número usado.
 * @typedef {Object} Contador
 * @property {number} ultimoNumero - Último número asignado (la próxima solicitud usa ultimoNumero + 1).
 * @example
 * { "ultimoNumero": 10 }
 */

/**
 * 📝 TRAZABILIDAD: evento del historial de una solicitud.
 * Subcolección "solicitudes/{id}/historial". Solo se agregan eventos: nunca se editan ni se borran.
 * Las notas también son eventos (accion = "notaAgregada").
 * @typedef {Object} EventoHistorial
 * @property {string} id - Id del documento.
 * @property {string} accion - Ver ACCIONES_HISTORIAL.
 * @property {string} usuarioId - uid de quien hizo la acción.
 * @property {string} usuarioNombre
 * @property {string} rolUsuario - Rol que tenía al momento de la acción.
 * @property {Timestamp} fecha - La pone el servidor (serverTimestamp), no el reloj del navegador.
 * @property {string|null} estadoAnterior - null en la creación y en eventos que no cambian el estado.
 * @property {string|null} estadoNuevo
 * @property {string|null} etapaAnterior
 * @property {string|null} etapaNueva
 * @property {string} comentario - Motivo de la acción o texto de la nota ("" si no hay).
 * @example
 * {
 *   "accion": "aprobada",
 *   "usuarioId": "uidSupervisor",
 *   "usuarioNombre": "Carlos Pérez",
 *   "rolUsuario": "supervisor",
 *   "fecha": "<Timestamp>",
 *   "estadoAnterior": "enAprobacion",
 *   "estadoNuevo": "enGestionRh",
 *   "etapaAnterior": "aprobacion",
 *   "etapaNueva": "gestionRh",
 *   "comentario": "Aprobado, coordinar cobertura"
 * }
 */

/**
 * Archivo adjunto de una solicitud, guardado en base64.
 * Subcolección "solicitudes/{id}/adjuntos" (separada para que listar solicitudes
 * no descargue los archivos). Máximo 600 KB por archivo (ver LIMITES_ADJUNTO).
 * @typedef {Object} Adjunto
 * @property {string} id - Id del documento.
 * @property {string} nombreArchivo
 * @property {string} tipoMime - "application/pdf", "image/jpeg" o "image/png".
 * @property {number} tamanoBytes - Tamaño del archivo original (antes del base64).
 * @property {string} contenidoBase64 - Contenido del archivo codificado en base64.
 * @property {string} subidoPor - uid de quien lo subió.
 * @property {string} subidoPorNombre
 * @property {Timestamp} fechaSubida
 * @example
 * {
 *   "nombreArchivo": "certificado.pdf",
 *   "tipoMime": "application/pdf",
 *   "tamanoBytes": 182340,
 *   "contenidoBase64": "JVBERi0xLjQK...",
 *   "subidoPor": "uidIniciador",
 *   "subidoPorNombre": "Ana Gómez",
 *   "fechaSubida": "<Timestamp>"
 * }
 */

// Archivo solo de tipos: el export vacío lo convierte en un ES module importable.
export {};
