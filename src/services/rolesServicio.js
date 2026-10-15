/**
 * =============================================================
 * Capa: SERVICIOS
 * Archivo: src/services/rolesServicio.js
 *
 * Responsabilidad:
 *   Casos de uso de la gestión de roles (solo el admin): ver el catálogo de
 *   los 4 roles del sistema, editar su nombre y descripción, y volver a crear
 *   un rol que falte (DECISIONES.md #25).
 *
 * Depende de: src/services/gestionRoles.js, src/services/catalogoRoles.js,
 *   src/services/authServicio.js, src/data/rolesRepositorio.js,
 *   src/data/usuariosRepositorio.js, src/config/constantes.js
 * =============================================================
 */

import { ROLES } from '../config/constantes.js';
import { actualizarRol, crearRol, listarRoles } from '../data/rolesRepositorio.js';
import { listarUsuarios } from '../data/usuariosRepositorio.js';
import { usuarioRequerido, errorParaUsuario } from './authServicio.js';
import { recordarNombreDeRol } from './catalogoRoles.js';
import { ErrorAplicacion } from './errores.js';
import { armarCatalogoRoles, prepararRolFaltante, rolesFaltantes, validarDatosRol } from './gestionRoles.js';

/** 🔒 SEGURIDAD: solo el admin gestiona roles (firestore.rules lo vuelve a exigir). */
const SOLO_ADMIN = [ROLES.ADMIN];

/**
 * Catálogo para la pantalla de roles.
 * @returns {Promise<{ roles: import('./gestionRoles.js').RolDelCatalogo[], faltantes: string[] }>}
 * @throws {ErrorAplicacion}
 */
export async function obtenerGestionRoles() {
  try {
    usuarioRequerido(SOLO_ADMIN);
    const [guardados, usuarios] = await Promise.all([listarRoles(), listarUsuarios()]);
    return { roles: armarCatalogoRoles(guardados, usuarios), faltantes: rolesFaltantes(guardados) };
  } catch (error) {
    throw errorParaUsuario(error, 'No se pudieron cargar los roles.');
  }
}

/**
 * Guarda el nombre y la descripción de un rol existente.
 * @param {string} clave
 * @param {{ nombre: string, descripcion: string }} datosFormulario
 * @returns {Promise<void>}
 * @throws {ErrorAplicacion}
 */
export async function guardarRol(clave, datosFormulario) {
  try {
    usuarioRequerido(SOLO_ADMIN);
    const guardados = await listarRoles();
    if (!guardados.some((r) => r.id === clave)) {
      throw new ErrorAplicacion('Ese rol no está en el catálogo: primero hay que crearlo.', 'rolFaltante');
    }
    const datos = validarDatosRol(datosFormulario);
    await actualizarRol(clave, datos);
    recordarNombreDeRol(clave, datos.nombre); // el nombre nuevo se ve enseguida en toda la app
  } catch (error) {
    throw errorParaUsuario(error, 'No se pudo guardar el rol.');
  }
}

/**
 * Vuelve a crear un rol del sistema que falta en el catálogo, con sus permisos de fábrica.
 * @param {string} clave - Una de ROLES que falte.
 * @param {{ nombre: string, descripcion: string }} datosFormulario
 * @returns {Promise<void>}
 * @throws {ErrorAplicacion} Si la clave no es de un rol del sistema o ya existe.
 */
export async function crearRolFaltante(clave, datosFormulario) {
  try {
    usuarioRequerido(SOLO_ADMIN);
    const datos = prepararRolFaltante(clave, datosFormulario, await listarRoles());
    await crearRol(clave, datos);
    recordarNombreDeRol(clave, datos.nombre);
  } catch (error) {
    throw errorParaUsuario(error, 'No se pudo crear el rol.');
  }
}
