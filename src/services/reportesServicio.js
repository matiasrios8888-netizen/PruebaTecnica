/**
 * =============================================================
 * Capa: SERVICIOS
 * Archivo: src/services/reportesServicio.js
 *
 * Responsabilidad:
 *   Caso de uso "ver los reportes de gestión" (solo RH y admin): lee los
 *   conteos por estado, los trámites abiertos y los usuarios, y arma los dos
 *   reportes con la lógica pura de reportes.js (DECISIONES.md #27).
 *
 * Depende de: src/services/reportes.js, src/services/authServicio.js,
 *   src/data/solicitudesRepositorio.js, src/data/usuariosRepositorio.js,
 *   src/config/constantes.js
 * =============================================================
 */

import { ESTADOS, ROLES_VEN_REPORTES } from '../config/constantes.js';
import { contarPorEstado, listarAbiertas } from '../data/solicitudesRepositorio.js';
import { listarUsuarios } from '../data/usuariosRepositorio.js';
import { usuarioRequerido, errorParaUsuario } from './authServicio.js';
import { cargaPorUsuario, distribucionPorEtapa } from './reportes.js';

/**
 * Los dos reportes, calculados en este momento.
 * @typedef {Object} Reportes
 * @property {ReturnType<typeof distribucionPorEtapa>} distribucion
 * @property {ReturnType<typeof cargaPorUsuario>} carga
 * @property {Date} generadoEn - Momento en que se leyeron los datos.
 */

/**
 * Lee los datos y arma los reportes.
 * Las consultas van en paralelo: 6 conteos (uno por estado), los trámites
 * abiertos y el directorio de usuarios.
 * @returns {Promise<Reportes>}
 * @throws {ErrorAplicacion} Sin sesión, sin permiso o error de conexión.
 */
export async function cargarReportes() {
  try {
    // 🔒 SEGURIDAD: solo RH y admin (firestore.rules rechaza estas consultas a los demás).
    usuarioRequerido(ROLES_VEN_REPORTES);
    const estados = Object.values(ESTADOS);
    const [conteos, abiertas, usuarios] = await Promise.all([
      Promise.all(estados.map(contarPorEstado)),
      listarAbiertas(),
      listarUsuarios(),
    ]);
    const conteoPorEstado = Object.fromEntries(estados.map((estado, i) => [estado, conteos[i]]));
    return {
      distribucion: distribucionPorEtapa(conteoPorEstado),
      carga: cargaPorUsuario(abiertas, usuarios, Date.now()),
      generadoEn: new Date(),
    };
  } catch (error) {
    throw errorParaUsuario(error, 'No se pudieron cargar los reportes.');
  }
}
