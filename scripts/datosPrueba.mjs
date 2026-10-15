/**
 * =============================================================
 * Script de datos de prueba – DATOS
 * Archivo: scripts/datosPrueba.mjs
 *
 * Responsabilidad:
 *   Describir QUÉ se carga en Firebase: usuarios de prueba y 10 solicitudes
 *   escritas como un "guion" de acciones. (El catálogo de roles sale de
 *   constantes.js: NOMBRES_ROL, DESCRIPCIONES_ROL y PERMISOS_POR_ROL.)
 *   CÓMO se carga (y la validación de cada paso) está en scripts/seed.mjs.
 *
 * Depende de: src/config/constantes.js
 *
 * Formato del guion de cada solicitud:
 *   - creadaHaceDias: cuántos días atrás se creó (las fechas son relativas al
 *     momento de correr el script, así los datos siempre se ven recientes).
 *   - inicioEnDias: cuántos días después de la creación empieza el permiso.
 *   - cantidadDias: días corridos del permiso (fechaFin se calcula).
 *   - adjuntosIniciales: archivos que el solicitante adjunta al crearla.
 *   - pasos: lo que pasó después, en orden. Cada paso ocurre "horas" después
 *     del anterior y lo hace el usuario "por". "accion" es una de ACCIONES
 *     (se valida contra TRANSICIONES) o PASO_NOTA / PASO_ADJUNTO. Al completar,
 *     "gestionRh" trae lo que carga RH (referencia y días descontados).
 *   - vistaPorAsignado: si el asignado actual ya la abrió (pestaña "Nuevas").
 * =============================================================
 */

import { ROLES, ACCIONES, TIPOS_PERMISO } from '../src/config/constantes.js';

/** Tipos de paso del guion que no cambian el estado de la solicitud. */
export const PASO_NOTA = 'nota';
export const PASO_ADJUNTO = 'adjunto';

/**
 * Contraseña común de los usuarios de prueba. Se puede cambiar con la variable
 * de entorno SEED_PASSWORD. Son cuentas de demostración: no protegen datos reales.
 */
export const PASSWORD_PRUEBA = process.env.SEED_PASSWORD ?? 'Bprosys2026!';

/**
 * Usuarios de prueba. La clave identifica a cada uno en los guiones: los 4
 * principales (uno por rol) usan su rol como clave.
 * "supervisor" indica la clave del usuario que aprueba sus solicitudes.
 * "activo: false" = dado de baja (baja lógica). Si no se indica, está activo.
 */
export const USUARIOS_PRUEBA = {
  [ROLES.INICIADOR]: {
    nombre: 'Ana Gómez',
    email: 'iniciador@bprosys.test',
    rol: ROLES.INICIADOR,
    area: 'Operaciones',
    supervisor: ROLES.SUPERVISOR,
  },
  [ROLES.SUPERVISOR]: {
    nombre: 'Carlos Pérez',
    email: 'supervisor@bprosys.test',
    rol: ROLES.SUPERVISOR,
    area: 'Operaciones',
    supervisor: null,
  },
  [ROLES.RH]: {
    nombre: 'Laura Fernández',
    email: 'rh@bprosys.test',
    rol: ROLES.RH,
    area: 'Recursos Humanos',
    supervisor: null,
  },
  [ROLES.ADMIN]: {
    nombre: 'Martín Sosa',
    email: 'admin@bprosys.test',
    rol: ROLES.ADMIN,
    area: 'Sistemas',
    supervisor: null,
  },
  // Para el mantenimiento (Fase 4): una supervisora sin equipo activo (se puede
  // dar de baja) y un iniciador dado de baja (se puede reactivar).
  sofia: {
    nombre: 'Sofía Díaz',
    email: 'sofia.diaz@bprosys.test',
    rol: ROLES.SUPERVISOR,
    area: 'Comercial',
    supervisor: null,
  },
  pedro: {
    nombre: 'Pedro Ruiz',
    email: 'pedro.ruiz@bprosys.test',
    rol: ROLES.INICIADOR,
    area: 'Comercial',
    supervisor: 'sofia',
    activo: false,
  },
};

/**
 * Las 10 solicitudes de prueba. Distribución final:
 *   3 enAprobacion (1 ya vista, 1 reenviada tras una devolución), 1 devuelta,
 *   3 enGestionRh, 2 completadas, 1 rechazada.
 */
export const SOLICITUDES_PRUEBA = [
  // 1 · enAprobacion, nueva (el supervisor todavía no la abrió)
  {
    tipoPermiso: TIPOS_PERMISO.VACACIONES,
    creadaHaceDias: 2,
    inicioEnDias: 20,
    cantidadDias: 5,
    motivo: 'Viaje familiar a la costa',
    adjuntosIniciales: [],
    pasos: [],
    vistaPorAsignado: false,
  },
  // 2 · enAprobacion, ya vista por el supervisor, con una nota del solicitante
  {
    tipoPermiso: TIPOS_PERMISO.PERSONAL,
    creadaHaceDias: 1,
    inicioEnDias: 6,
    cantidadDias: 1,
    motivo: 'Trámite personal en el banco',
    adjuntosIniciales: [],
    pasos: [
      { accion: PASO_NOTA, por: ROLES.INICIADOR, horas: 1, comentario: 'Puedo compensar las horas el viernes.' },
    ],
    vistaPorAsignado: true,
  },
  // 3 · enAprobacion de nuevo: fue devuelta, se corrigió y se reenvió
  {
    tipoPermiso: TIPOS_PERMISO.ESTUDIO,
    creadaHaceDias: 8,
    inicioEnDias: 14,
    cantidadDias: 2,
    motivo: 'Examen final de la carrera',
    adjuntosIniciales: [{ nombreArchivo: 'constancia-examen.pdf', titulo: 'Constancia de examen' }],
    pasos: [
      {
        accion: ACCIONES.DEVOLVER,
        por: ROLES.SUPERVISOR,
        horas: 20,
        comentario: 'La constancia no tiene la firma de la facultad. Adjuntá la versión firmada.',
      },
      {
        accion: PASO_ADJUNTO,
        por: ROLES.INICIADOR,
        horas: 30,
        archivo: { nombreArchivo: 'constancia-examen-firmada.pdf', titulo: 'Constancia de examen (firmada)' },
      },
      { accion: ACCIONES.REENVIAR, por: ROLES.INICIADOR, horas: 1, comentario: 'Adjunté la constancia firmada.' },
    ],
    vistaPorAsignado: false,
  },
  // 4 · devuelta al solicitante (todavía no la abrió)
  {
    tipoPermiso: TIPOS_PERMISO.VACACIONES,
    creadaHaceDias: 5,
    inicioEnDias: 25,
    cantidadDias: 10,
    motivo: 'Vacaciones de fin de año',
    adjuntosIniciales: [],
    pasos: [
      {
        accion: ACCIONES.DEVOLVER,
        por: ROLES.SUPERVISOR,
        horas: 26,
        comentario: 'Se superpone con el cierre de mes. ¿Podés moverlas una semana?',
      },
    ],
    vistaPorAsignado: false,
  },
  // 5 · enGestionRh, nueva para RH
  {
    tipoPermiso: TIPOS_PERMISO.ENFERMEDAD,
    creadaHaceDias: 6,
    inicioEnDias: 0,
    cantidadDias: 3,
    motivo: 'Reposo por gripe indicado por el médico',
    adjuntosIniciales: [{ nombreArchivo: 'certificado-medico.pdf', titulo: 'Certificado medico' }],
    pasos: [{ accion: ACCIONES.APROBAR, por: ROLES.SUPERVISOR, horas: 4, comentario: 'Que te mejores.' }],
    vistaPorAsignado: false,
  },
  // 6 · enGestionRh, ya vista por RH, con una nota interna de RH
  {
    tipoPermiso: TIPOS_PERMISO.VACACIONES,
    creadaHaceDias: 10,
    inicioEnDias: 30,
    cantidadDias: 7,
    motivo: 'Viaje al exterior',
    adjuntosIniciales: [],
    pasos: [
      {
        accion: ACCIONES.APROBAR,
        por: ROLES.SUPERVISOR,
        horas: 5,
        comentario: 'Aprobado. Coordiná la cobertura con el equipo.',
      },
      { accion: PASO_NOTA, por: ROLES.RH, horas: 22, comentario: 'Verificando el saldo de vacaciones disponible.' },
    ],
    vistaPorAsignado: true,
  },
  // 7 · enGestionRh, nueva para RH
  {
    tipoPermiso: TIPOS_PERMISO.DUELO,
    creadaHaceDias: 3,
    inicioEnDias: 0,
    cantidadDias: 3,
    motivo: 'Fallecimiento de un familiar directo',
    adjuntosIniciales: [{ nombreArchivo: 'acta-defuncion.pdf', titulo: 'Acta de defuncion' }],
    pasos: [{ accion: ACCIONES.APROBAR, por: ROLES.SUPERVISOR, horas: 1, comentario: 'Mis condolencias.' }],
    vistaPorAsignado: false,
  },
  // 8 · completada por RH
  {
    tipoPermiso: TIPOS_PERMISO.MATERNIDAD_PATERNIDAD,
    creadaHaceDias: 25,
    inicioEnDias: 10,
    cantidadDias: 15,
    motivo: 'Licencia por nacimiento de mi hija',
    adjuntosIniciales: [{ nombreArchivo: 'partida-nacimiento.pdf', titulo: 'Partida de nacimiento' }],
    pasos: [
      { accion: ACCIONES.APROBAR, por: ROLES.SUPERVISOR, horas: 6, comentario: '¡Felicitaciones!' },
      {
        accion: ACCIONES.COMPLETAR,
        por: ROLES.RH,
        horas: 48,
        comentario: 'Licencia registrada en el sistema de liquidación de sueldos.',
        gestionRh: { referenciaRh: 'LIQ-2026-0918', diasDescontados: 15 },
      },
    ],
  },
  // 9 · completada por RH
  {
    tipoPermiso: TIPOS_PERMISO.PERSONAL,
    creadaHaceDias: 20,
    inicioEnDias: 4,
    cantidadDias: 1,
    motivo: 'Mudanza',
    adjuntosIniciales: [],
    pasos: [
      { accion: ACCIONES.APROBAR, por: ROLES.SUPERVISOR, horas: 3, comentario: '' },
      {
        accion: ACCIONES.COMPLETAR,
        por: ROLES.RH,
        horas: 24,
        comentario: 'Registrado.',
        gestionRh: { referenciaRh: 'LIQ-2026-0927', diasDescontados: 1 },
      },
    ],
  },
  // 10 · rechazada por el supervisor
  {
    tipoPermiso: TIPOS_PERMISO.VACACIONES,
    creadaHaceDias: 15,
    inicioEnDias: 40,
    cantidadDias: 15,
    motivo: 'Vacaciones de verano',
    adjuntosIniciales: [],
    pasos: [
      {
        accion: ACCIONES.RECHAZAR,
        por: ROLES.SUPERVISOR,
        horas: 30,
        comentario: 'No es posible: coincide con el pico de trabajo de fin de año. Proponé otra fecha.',
      },
    ],
  },
];
