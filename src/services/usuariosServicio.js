/**
 * =============================================================
 * Capa: SERVICIOS
 * Archivo: src/services/usuariosServicio.js
 *
 * Responsabilidad:
 *   Casos de uso del mantenimiento de usuarios (solo el admin): listar,
 *   dar de alta, editar, dar de baja, reactivar y pedir el cambio de contraseña.
 *
 *   Orquesta: verifica que quien opera sea admin, lee datos frescos, aplica la
 *   lógica pura de gestionUsuarios.js y pide a los repositorios que guarden.
 *   Todos los errores salen como ErrorAplicacion con mensaje en español.
 *
 * Depende de: src/services/gestionUsuarios.js, src/services/authServicio.js,
 *   src/services/errores.js, src/data/usuariosRepositorio.js, src/config/constantes.js
 * =============================================================
 */

import { ROLES } from '../config/constantes.js';
import { listarUsuarios } from '../data/usuariosRepositorio.js';
import { usuarioRequerido, errorParaUsuario } from './authServicio.js';

/** @typedef {import('../data/modelos.js').Usuario} Usuario */

/** 🔒 SEGURIDAD: solo el admin gestiona usuarios (firestore.rules lo vuelve a exigir). */
const SOLO_ADMIN = [ROLES.ADMIN];

/**
 * Lista todos los usuarios (activos e inactivos), ordenados por nombre.
 * @returns {Promise<Usuario[]>}
 * @throws {ErrorAplicacion} Sin sesión, sin permiso o error de conexión.
 */
export async function cargarUsuarios() {
  try {
    usuarioRequerido(SOLO_ADMIN);
    return await listarUsuarios();
  } catch (error) {
    throw errorParaUsuario(error, 'No se pudieron cargar los usuarios.');
  }
}
