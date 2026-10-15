/**
 * =============================================================
 * Capa: SERVICIOS (lógica pura, sin Firebase ni DOM)
 * Archivo: src/services/reportes.js
 *
 * Responsabilidad:
 *   Calcular los reportes de gestión a partir de datos ya leídos:
 *   - distribución de trámites por etapa (con el detalle por estado);
 *   - carga de tareas pendientes por usuario.
 *   Se prueba en Node (scripts/tests/reportes.test.mjs).
 *
 * Depende de: src/config/constantes.js
 * =============================================================
 */

import {
  ESTADOS,
  ETAPA_DE_ESTADO,
  ETAPAS,
  NOMBRES_ESTADO,
  NOMBRES_ETAPA,
  ROLES,
} from '../config/constantes.js';

/** @typedef {import('../data/modelos.js').Solicitud} Solicitud */
/** @typedef {import('../data/modelos.js').Usuario} Usuario */

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Porcentaje entero de "parte" sobre "total" (0 si no hay total). */
const porcentaje = (parte, total) => (total > 0 ? Math.round((parte / total) * 100) : 0);

// -------------------------------------------------------------
// Distribución por etapa
// -------------------------------------------------------------

/**
 * Una etapa del reporte de distribución.
 * @typedef {Object} EtapaDelReporte
 * @property {string} etapa - Una de ETAPAS.
 * @property {string} nombre
 * @property {number} cantidad
 * @property {number} porcentaje - Sobre el total de trámites (entero).
 * @property {{ estado: string, nombre: string, cantidad: number }[]} estados - Detalle (solo los que tienen trámites).
 */

/**
 * Arma la distribución por etapa sumando los conteos por estado.
 * Las etapas salen en el orden del proceso (Solicitud → Aprobación → Gestión RH → Finalizada).
 * @param {Record<string, number>} conteoPorEstado - Ej: { enAprobacion: 3, devuelta: 1, … }.
 *   Un estado que no está cuenta como 0.
 * @returns {{ total: number, abiertos: number, etapas: EtapaDelReporte[] }}
 */
export function distribucionPorEtapa(conteoPorEstado) {
  const cantidadDe = (estado) => conteoPorEstado[estado] ?? 0;
  const total = Object.values(ESTADOS).reduce((suma, estado) => suma + cantidadDe(estado), 0);

  const etapas = Object.values(ETAPAS).map((etapa) => {
    const estados = Object.values(ESTADOS)
      .filter((estado) => ETAPA_DE_ESTADO[estado] === etapa && cantidadDe(estado) > 0)
      .map((estado) => ({ estado, nombre: NOMBRES_ESTADO[estado], cantidad: cantidadDe(estado) }));
    const cantidad = estados.reduce((suma, e) => suma + e.cantidad, 0);
    return { etapa, nombre: NOMBRES_ETAPA[etapa], cantidad, porcentaje: porcentaje(cantidad, total), estados };
  });

  const finalizados = etapas.find((e) => e.etapa === ETAPAS.FINALIZADA).cantidad;
  return { total, abiertos: total - finalizados, etapas };
}

// -------------------------------------------------------------
// Carga de pendientes por usuario
// -------------------------------------------------------------

/**
 * Una fila del reporte de carga.
 * @typedef {Object} CargaDeUsuario
 * @property {string} usuarioId
 * @property {string} nombre
 * @property {string|null} rol - null si el usuario ya no existe en "usuarios".
 * @property {boolean} activo
 * @property {number} pendientes - Trámites asignados a esta persona.
 * @property {number} nuevas - De esos, los que todavía no abrió.
 * @property {{ id: string, numero: string, dias: number }|null} masAntiguo - El trámite más viejo
 *   de su bandeja y hace cuántos días se creó.
 */

/**
 * Carga de tareas pendientes por usuario.
 *
 * ⚠️ IMPORTANTE: cada trámite abierto está asignado a una persona concreta
 * (asignadoA), así que la carga se calcula agrupando los trámites abiertos.
 * Además de quien tiene tareas, se listan con 0 los supervisores y RH activos:
 * ver que alguien que aprueba o gestiona está libre también es información.
 *
 * @param {Solicitud[]} abiertas - Trámites en curso (estados abiertos).
 * @param {Usuario[]} usuarios - Todos los usuarios.
 * @param {number} ahora - Milisegundos (Date.now()); se recibe para poder testear.
 * @returns {{ filas: CargaDeUsuario[], totalPendientes: number, totalNuevas: number, conProblemas: CargaDeUsuario[] }}
 *   Filas ordenadas de mayor a menor carga (y por nombre). "conProblemas": usuarios
 *   dados de baja o inexistentes que tienen trámites asignados (no debería pasar:
 *   el mantenimiento lo bloquea, DECISIONES.md #24).
 */
export function cargaPorUsuario(abiertas, usuarios, ahora) {
  const porId = new Map(usuarios.map((u) => [u.id, u]));
  /** @type {Map<string, CargaDeUsuario>} */
  const filas = new Map();

  const filaDe = (usuarioId, nombreRespaldo) => {
    if (!filas.has(usuarioId)) {
      const usuario = porId.get(usuarioId);
      filas.set(usuarioId, {
        usuarioId,
        nombre: usuario?.nombre ?? nombreRespaldo ?? usuarioId,
        rol: usuario?.rol ?? null,
        activo: usuario?.activo ?? false,
        pendientes: 0,
        nuevas: 0,
        masAntiguo: null,
      });
    }
    return filas.get(usuarioId);
  };

  for (const usuario of usuarios) {
    if (usuario.activo && (usuario.rol === ROLES.SUPERVISOR || usuario.rol === ROLES.RH)) filaDe(usuario.id);
  }

  for (const solicitud of abiertas) {
    if (!solicitud.asignadoA) continue;
    const fila = filaDe(solicitud.asignadoA, solicitud.asignadoNombre);
    fila.pendientes += 1;
    if (!solicitud.vistaPorAsignado) fila.nuevas += 1;

    const creada = solicitud.fechaCreacion?.toMillis?.();
    if (creada !== undefined) {
      const dias = Math.max(0, Math.floor((ahora - creada) / MS_POR_DIA));
      if (!fila.masAntiguo || dias > fila.masAntiguo.dias) {
        fila.masAntiguo = { id: solicitud.id, numero: solicitud.numero, dias };
      }
    }
  }

  const ordenadas = [...filas.values()].sort(
    (a, b) => b.pendientes - a.pendientes || a.nombre.localeCompare(b.nombre, 'es'),
  );
  return {
    filas: ordenadas,
    totalPendientes: ordenadas.reduce((suma, f) => suma + f.pendientes, 0),
    totalNuevas: ordenadas.reduce((suma, f) => suma + f.nuevas, 0),
    conProblemas: ordenadas.filter((f) => f.pendientes > 0 && (!f.activo || f.rol === null)),
  };
}
