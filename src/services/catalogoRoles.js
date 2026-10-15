/**
 * =============================================================
 * Capa: SERVICIOS
 * Archivo: src/services/catalogoRoles.js
 *
 * Responsabilidad:
 *   Guardar en memoria los nombres de los roles del catálogo, para que toda
 *   la app muestre el nombre que eligió el admin (por ejemplo "RRHH" en vez
 *   de "Recursos Humanos"). Se carga una vez al iniciar sesión.
 *   Si un rol falta en la base o la lectura falla, se usa el nombre de
 *   fábrica (NOMBRES_ROL): la app nunca se queda sin poder mostrar un rol.
 *
 * Depende de: src/data/rolesRepositorio.js, src/config/constantes.js
 * =============================================================
 */

import { NOMBRES_ROL } from '../config/constantes.js';
import { listarRoles } from '../data/rolesRepositorio.js';

/** Nombre guardado de cada rol, por clave. */
let nombres = {};

/** Carga en curso, para no leer dos veces si se pide a la vez (login + observador de sesión). */
let cargaEnCurso = null;

/**
 * Lee el catálogo de roles y guarda sus nombres. Nunca falla: si no puede
 * leer, deja los nombres de fábrica.
 * @returns {Promise<void>}
 */
export function cargarCatalogoRoles() {
  cargaEnCurso ??= listarRoles()
    .then((roles) => {
      nombres = Object.fromEntries(roles.map((rol) => [rol.id, rol.nombre]));
    })
    .catch((error) => {
      console.warn('[catalogoRoles] Se usan los nombres de fábrica:', error.code ?? error);
      nombres = {};
    })
    .finally(() => {
      cargaEnCurso = null;
    });
  return cargaEnCurso;
}

/** Olvida los nombres cargados (al cerrar sesión). */
export function limpiarCatalogoRoles() {
  nombres = {};
}

/**
 * Actualiza el nombre de un rol en memoria después de editarlo o crearlo.
 * @param {string} clave
 * @param {string} nombre
 */
export function recordarNombreDeRol(clave, nombre) {
  nombres = { ...nombres, [clave]: nombre };
}

/**
 * Nombre para mostrar de un rol.
 * @param {string} clave - Una de ROLES.
 * @returns {string} El nombre del catálogo, o el de fábrica si no está cargado.
 */
export function nombreDeRol(clave) {
  return nombres[clave] ?? NOMBRES_ROL[clave] ?? clave;
}
