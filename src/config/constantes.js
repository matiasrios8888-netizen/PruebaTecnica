/**
 * =============================================================
 * Capa: CONFIGURACIÓN
 * Archivo: src/config/constantes.js
 *
 * Responsabilidad:
 *   Única fuente de verdad para los valores fijos del dominio: roles,
 *   etapas, estados, transiciones del flujo, tipos de permiso, acciones
 *   del historial, límites de adjuntos y nombres de colecciones.
 *   Ningún otro archivo debe escribir estos textos "a mano".
 *
 * Depende de: nada (no importa Firebase ni el DOM). Por eso lo puede
 *   importar tanto la app del navegador como el script de datos de prueba
 *   que corre en Node (scripts/seed.mjs).
 *
 * Nota: firestore.rules no puede importar JavaScript, así que repite
 *   algunos de estos valores. Si cambia algo acá, revisar también las reglas.
 * =============================================================
 */

/** Nombres de las colecciones y subcolecciones de Firestore. */
export const COLECCIONES = Object.freeze({
  USUARIOS: 'usuarios',
  ROLES: 'roles',
  SOLICITUDES: 'solicitudes',
  HISTORIAL: 'historial', // subcolección de cada solicitud
  ADJUNTOS: 'adjuntos', // subcolección de cada solicitud
  CONTADORES: 'contadores',
});

/**
 * Máximo de solicitudes que trae cada consulta de la bandeja. Filtros, orden y
 * búsqueda se aplican en el navegador sobre ese resultado (DECISIONES.md #22).
 */
export const LIMITE_BANDEJA = 200;

/** Pestañas de la bandeja. */
export const PESTANAS_BANDEJA = Object.freeze({
  PENDIENTES: 'pendientes', // asignadas a mí
  NUEVAS: 'nuevas', // asignadas a mí y todavía no abiertas
  ENVIADAS: 'enviadas', // intervine y ya no están en mis manos
  TODAS: 'todas', // todas las de la empresa (solo ROLES_VEN_TODAS)
});

export const NOMBRES_PESTANA = Object.freeze({
  [PESTANAS_BANDEJA.PENDIENTES]: 'Pendientes',
  [PESTANAS_BANDEJA.NUEVAS]: 'Nuevas',
  [PESTANAS_BANDEJA.ENVIADAS]: 'Enviadas',
  [PESTANAS_BANDEJA.TODAS]: 'Todas',
});

/** Criterios de orden de la bandeja. */
export const ORDENES_BANDEJA = Object.freeze({
  RECIENTES: 'recientes',
  ANTIGUAS: 'antiguas',
  INICIO_PROXIMO: 'inicioProximo',
  INICIO_LEJANO: 'inicioLejano',
  NUMERO_DESC: 'numeroDesc',
  NUMERO_ASC: 'numeroAsc',
});

export const NOMBRES_ORDEN = Object.freeze({
  [ORDENES_BANDEJA.RECIENTES]: 'Actualizadas recientemente',
  [ORDENES_BANDEJA.ANTIGUAS]: 'Actualizadas hace más tiempo',
  [ORDENES_BANDEJA.INICIO_PROXIMO]: 'Fecha de inicio (más próxima)',
  [ORDENES_BANDEJA.INICIO_LEJANO]: 'Fecha de inicio (más lejana)',
  [ORDENES_BANDEJA.NUMERO_DESC]: 'Número (mayor a menor)',
  [ORDENES_BANDEJA.NUMERO_ASC]: 'Número (menor a mayor)',
});

/**
 * Numeración correlativa de las solicitudes ("SOL-0001").
 * El último número usado vive en contadores/{ID_CONTADOR}.ultimoNumero y se
 * incrementa dentro de una transacción al crear cada solicitud.
 * 🔒 SEGURIDAD: firestore.rules exige que el número tenga 4 dígitos (hasta SOL-9999).
 */
export const NUMERACION_SOLICITUD = Object.freeze({
  ID_CONTADOR: 'solicitudes',
  PREFIJO: 'SOL-',
  DIGITOS: 4,
});

// -------------------------------------------------------------
// Roles
// -------------------------------------------------------------

/** Claves de los roles (también son los ids de los documentos de la colección "roles"). */
export const ROLES = Object.freeze({
  INICIADOR: 'iniciador',
  SUPERVISOR: 'supervisor',
  RH: 'rh',
  ADMIN: 'admin',
});

/**
 * 🔒 SEGURIDAD: roles que pueden ver TODAS las solicitudes (pestaña "Todas",
 * reportes). firestore.rules aplica la misma lista en la regla de lectura.
 */
export const ROLES_VEN_TODAS = Object.freeze([ROLES.RH, ROLES.ADMIN]);

/** Texto para mostrar de cada rol. */
export const NOMBRES_ROL = Object.freeze({
  [ROLES.INICIADOR]: 'Iniciador',
  [ROLES.SUPERVISOR]: 'Supervisor',
  [ROLES.RH]: 'Recursos Humanos',
  [ROLES.ADMIN]: 'Administrador',
});

/**
 * Permisos (capacidades) que puede tener un rol. Se guardan en el campo
 * "permisos" de cada documento de la colección "roles" y se usan en la
 * gestión de roles (Fase 4).
 */
export const PERMISOS = Object.freeze({
  SOLICITUD_CREAR: 'solicitud.crear',
  SOLICITUD_APROBAR: 'solicitud.aprobar',
  SOLICITUD_DEVOLVER: 'solicitud.devolver',
  SOLICITUD_RECHAZAR: 'solicitud.rechazar',
  SOLICITUD_GESTIONAR_RH: 'solicitud.gestionarRh',
  SOLICITUD_VER_TODAS: 'solicitud.verTodas',
  USUARIOS_GESTIONAR: 'usuarios.gestionar',
  ROLES_GESTIONAR: 'roles.gestionar',
  REPORTES_VER: 'reportes.ver',
});

/** Permisos iniciales de cada rol (los usa el script de datos de prueba). */
export const PERMISOS_POR_ROL = Object.freeze({
  [ROLES.INICIADOR]: [PERMISOS.SOLICITUD_CREAR],
  [ROLES.SUPERVISOR]: [
    PERMISOS.SOLICITUD_APROBAR,
    PERMISOS.SOLICITUD_DEVOLVER,
    PERMISOS.SOLICITUD_RECHAZAR,
  ],
  [ROLES.RH]: [
    PERMISOS.SOLICITUD_GESTIONAR_RH,
    PERMISOS.SOLICITUD_VER_TODAS,
    PERMISOS.REPORTES_VER,
  ],
  [ROLES.ADMIN]: [
    PERMISOS.SOLICITUD_VER_TODAS,
    PERMISOS.USUARIOS_GESTIONAR,
    PERMISOS.ROLES_GESTIONAR,
    PERMISOS.REPORTES_VER,
  ],
});

// -------------------------------------------------------------
// Etapas y estados del trámite
// -------------------------------------------------------------

/**
 * Etapa = en qué parte del proceso está el trámite (Solicitar → Aprobar → Gestionar RH).
 * Es la base del reporte "distribución de trámites por etapa".
 */
export const ETAPAS = Object.freeze({
  SOLICITUD: 'solicitud',
  APROBACION: 'aprobacion',
  GESTION_RH: 'gestionRh',
  FINALIZADA: 'finalizada',
});

export const NOMBRES_ETAPA = Object.freeze({
  [ETAPAS.SOLICITUD]: 'Solicitud',
  [ETAPAS.APROBACION]: 'Aprobación',
  [ETAPAS.GESTION_RH]: 'Gestión RH',
  [ETAPAS.FINALIZADA]: 'Finalizada',
});

/**
 * Estado = qué pasó exactamente con el trámite.
 * Varios estados pueden compartir etapa (ej: "completada" y "rechazada" → "finalizada").
 */
export const ESTADOS = Object.freeze({
  EN_APROBACION: 'enAprobacion',
  DEVUELTA: 'devuelta',
  EN_GESTION_RH: 'enGestionRh',
  COMPLETADA: 'completada',
  RECHAZADA: 'rechazada',
  CANCELADA: 'cancelada',
});

export const NOMBRES_ESTADO = Object.freeze({
  [ESTADOS.EN_APROBACION]: 'En aprobación',
  [ESTADOS.DEVUELTA]: 'Devuelta para corrección',
  [ESTADOS.EN_GESTION_RH]: 'En gestión RH',
  [ESTADOS.COMPLETADA]: 'Completada',
  [ESTADOS.RECHAZADA]: 'Rechazada',
  [ESTADOS.CANCELADA]: 'Cancelada',
});

/** Estados en los que el trámite ya no tiene a nadie asignado. */
export const ESTADOS_FINALES = Object.freeze([
  ESTADOS.COMPLETADA,
  ESTADOS.RECHAZADA,
  ESTADOS.CANCELADA,
]);

// -------------------------------------------------------------
// Historial (trazabilidad)
// -------------------------------------------------------------

/** 📝 TRAZABILIDAD: valores posibles del campo "accion" de cada evento del historial. */
export const ACCIONES_HISTORIAL = Object.freeze({
  CREADA: 'creada',
  APROBADA: 'aprobada',
  DEVUELTA: 'devuelta',
  REENVIADA: 'reenviada',
  RECHAZADA: 'rechazada',
  COMPLETADA: 'completada',
  CANCELADA: 'cancelada',
  NOTA_AGREGADA: 'notaAgregada',
  ADJUNTO_AGREGADO: 'adjuntoAgregado',
});

export const NOMBRES_ACCION_HISTORIAL = Object.freeze({
  [ACCIONES_HISTORIAL.CREADA]: 'Creó la solicitud',
  [ACCIONES_HISTORIAL.APROBADA]: 'Aprobó la solicitud',
  [ACCIONES_HISTORIAL.DEVUELTA]: 'Devolvió la solicitud para corrección',
  [ACCIONES_HISTORIAL.REENVIADA]: 'Reenvió la solicitud corregida',
  [ACCIONES_HISTORIAL.RECHAZADA]: 'Rechazó la solicitud',
  [ACCIONES_HISTORIAL.COMPLETADA]: 'Completó la gestión en RH',
  [ACCIONES_HISTORIAL.CANCELADA]: 'Canceló la solicitud',
  [ACCIONES_HISTORIAL.NOTA_AGREGADA]: 'Agregó una nota',
  [ACCIONES_HISTORIAL.ADJUNTO_AGREGADO]: 'Adjuntó un archivo',
});

// -------------------------------------------------------------
// Flujo: acciones y transiciones de estado
// -------------------------------------------------------------

/** Acciones que un usuario puede ejecutar sobre una solicitud. */
export const ACCIONES = Object.freeze({
  CREAR: 'crear',
  APROBAR: 'aprobar',
  DEVOLVER: 'devolver',
  REENVIAR: 'reenviar',
  RECHAZAR: 'rechazar',
  COMPLETAR: 'completar',
  RECHAZAR_RH: 'rechazarRh',
  CANCELAR: 'cancelar',
});

/** Texto del botón de cada acción en la pantalla de detalle. */
export const NOMBRES_ACCION = Object.freeze({
  [ACCIONES.CREAR]: 'Crear solicitud',
  [ACCIONES.APROBAR]: 'Aprobar',
  [ACCIONES.DEVOLVER]: 'Devolver para corregir',
  [ACCIONES.REENVIAR]: 'Reenviar corregida',
  [ACCIONES.RECHAZAR]: 'Rechazar',
  [ACCIONES.COMPLETAR]: 'Completar gestión',
  [ACCIONES.RECHAZAR_RH]: 'Rechazar en RH',
  [ACCIONES.CANCELAR]: 'Cancelar solicitud',
});

/**
 * Quién puede ejecutar una acción, además de tener el rol requerido:
 *   - ASIGNADO: el usuario que figura en "asignadoA" de la solicitud.
 *   - SOLICITANTE: el usuario que creó la solicitud ("solicitanteId").
 */
export const EJECUTORES = Object.freeze({
  ASIGNADO: 'asignado',
  SOLICITANTE: 'solicitante',
});

/**
 * ⚠️ IMPORTANTE: tabla de transiciones del flujo Solicitar → Aprobar → Gestionar RH.
 * Cualquier cambio de estado que no figure acá es inválido. La usa el servicio de
 * solicitudes para validar y firestore.rules la replica en el servidor.
 *
 * Campos de cada transición:
 *   - estadosOrigen: estados desde los que se puede ejecutar ([] = solicitud nueva).
 *   - estadoNuevo / etapaNueva: a dónde pasa el trámite.
 *   - rolRequerido: rol que debe tener quien ejecuta.
 *   - ejecutor: si tiene que ser el asignado o el solicitante.
 *   - accionHistorial: qué evento se registra en el historial.
 *   - requiereComentario: si el usuario está obligado a explicar el motivo.
 */
export const TRANSICIONES = Object.freeze({
  [ACCIONES.CREAR]: {
    estadosOrigen: [],
    estadoNuevo: ESTADOS.EN_APROBACION,
    etapaNueva: ETAPAS.APROBACION,
    rolRequerido: ROLES.INICIADOR,
    ejecutor: EJECUTORES.SOLICITANTE,
    accionHistorial: ACCIONES_HISTORIAL.CREADA,
    requiereComentario: false,
  },
  [ACCIONES.APROBAR]: {
    estadosOrigen: [ESTADOS.EN_APROBACION],
    estadoNuevo: ESTADOS.EN_GESTION_RH,
    etapaNueva: ETAPAS.GESTION_RH,
    rolRequerido: ROLES.SUPERVISOR,
    ejecutor: EJECUTORES.ASIGNADO,
    accionHistorial: ACCIONES_HISTORIAL.APROBADA,
    requiereComentario: false,
  },
  [ACCIONES.DEVOLVER]: {
    estadosOrigen: [ESTADOS.EN_APROBACION],
    estadoNuevo: ESTADOS.DEVUELTA,
    etapaNueva: ETAPAS.SOLICITUD,
    rolRequerido: ROLES.SUPERVISOR,
    ejecutor: EJECUTORES.ASIGNADO,
    accionHistorial: ACCIONES_HISTORIAL.DEVUELTA,
    requiereComentario: true,
  },
  [ACCIONES.REENVIAR]: {
    estadosOrigen: [ESTADOS.DEVUELTA],
    estadoNuevo: ESTADOS.EN_APROBACION,
    etapaNueva: ETAPAS.APROBACION,
    rolRequerido: ROLES.INICIADOR,
    ejecutor: EJECUTORES.SOLICITANTE,
    accionHistorial: ACCIONES_HISTORIAL.REENVIADA,
    requiereComentario: false,
  },
  [ACCIONES.RECHAZAR]: {
    estadosOrigen: [ESTADOS.EN_APROBACION],
    estadoNuevo: ESTADOS.RECHAZADA,
    etapaNueva: ETAPAS.FINALIZADA,
    rolRequerido: ROLES.SUPERVISOR,
    ejecutor: EJECUTORES.ASIGNADO,
    accionHistorial: ACCIONES_HISTORIAL.RECHAZADA,
    requiereComentario: true,
  },
  [ACCIONES.COMPLETAR]: {
    estadosOrigen: [ESTADOS.EN_GESTION_RH],
    estadoNuevo: ESTADOS.COMPLETADA,
    etapaNueva: ETAPAS.FINALIZADA,
    rolRequerido: ROLES.RH,
    ejecutor: EJECUTORES.ASIGNADO,
    accionHistorial: ACCIONES_HISTORIAL.COMPLETADA,
    requiereComentario: false,
  },
  [ACCIONES.RECHAZAR_RH]: {
    estadosOrigen: [ESTADOS.EN_GESTION_RH],
    estadoNuevo: ESTADOS.RECHAZADA,
    etapaNueva: ETAPAS.FINALIZADA,
    rolRequerido: ROLES.RH,
    ejecutor: EJECUTORES.ASIGNADO,
    accionHistorial: ACCIONES_HISTORIAL.RECHAZADA,
    requiereComentario: true,
  },
  [ACCIONES.CANCELAR]: {
    estadosOrigen: [ESTADOS.EN_APROBACION, ESTADOS.DEVUELTA],
    estadoNuevo: ESTADOS.CANCELADA,
    etapaNueva: ETAPAS.FINALIZADA,
    rolRequerido: ROLES.INICIADOR,
    ejecutor: EJECUTORES.SOLICITANTE,
    accionHistorial: ACCIONES_HISTORIAL.CANCELADA,
    requiereComentario: false,
  },
});

// -------------------------------------------------------------
// Tipos de permiso
// -------------------------------------------------------------

/** Claves de los tipos de permiso (valor del campo "tipoPermiso" de una solicitud). */
export const TIPOS_PERMISO = Object.freeze({
  VACACIONES: 'vacaciones',
  ENFERMEDAD: 'enfermedad',
  PERSONAL: 'personal',
  ESTUDIO: 'estudio',
  DUELO: 'duelo',
  MATERNIDAD_PATERNIDAD: 'maternidadPaternidad',
});

/**
 * ⚠️ IMPORTANTE: reglas de negocio de cada tipo de permiso.
 *   - requiereAdjunto: el trámite debe tener al menos un archivo (ej: certificado médico).
 *   - diasMaximos: tope de días corridos que se pueden pedir en una solicitud.
 */
export const CONFIG_TIPOS_PERMISO = Object.freeze({
  [TIPOS_PERMISO.VACACIONES]: { nombre: 'Vacaciones', requiereAdjunto: false, diasMaximos: 15 },
  [TIPOS_PERMISO.ENFERMEDAD]: { nombre: 'Enfermedad', requiereAdjunto: true, diasMaximos: 30 },
  [TIPOS_PERMISO.PERSONAL]: { nombre: 'Asunto personal', requiereAdjunto: false, diasMaximos: 2 },
  [TIPOS_PERMISO.ESTUDIO]: { nombre: 'Estudio / examen', requiereAdjunto: true, diasMaximos: 5 },
  [TIPOS_PERMISO.DUELO]: { nombre: 'Duelo', requiereAdjunto: true, diasMaximos: 5 },
  [TIPOS_PERMISO.MATERNIDAD_PATERNIDAD]: {
    nombre: 'Maternidad / paternidad',
    requiereAdjunto: true,
    diasMaximos: 90,
  },
});

// -------------------------------------------------------------
// Adjuntos
// -------------------------------------------------------------

/**
 * ⚠️ IMPORTANTE: límites de los archivos adjuntos (se guardan en Firestore en base64).
 * Un documento de Firestore admite como máximo 1 MiB (1.048.576 bytes) y el base64
 * agranda el archivo ~33% (4 caracteres por cada 3 bytes):
 *   600 KB = 614.400 bytes → 819.200 caracteres en base64 → quedan ~229 KB de margen
 *   para el resto de los campos del documento.
 * 🔒 SEGURIDAD: firestore.rules valida los mismos números en el servidor.
 */
export const LIMITES_ADJUNTO = Object.freeze({
  tamanoMaximoBytes: 600 * 1024, // 614.400
  longitudMaximaBase64: Math.ceil((600 * 1024) / 3) * 4, // 819.200
  tiposMimePermitidos: Object.freeze(['application/pdf', 'image/jpeg', 'image/png']),
  // Archivos que se pueden adjuntar al crear la solicitud (todos viajan en una sola
  // transacción; Firestore limita cada operación a 10 MiB).
  maximoAlCrear: 3,
});
