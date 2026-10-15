/**
 * =============================================================
 * Capa: SERVICIOS (lógica pura, sin Firebase ni DOM)
 * Archivo: src/services/gestionRoles.js
 *
 * Responsabilidad:
 *   Reglas de negocio de la gestión de roles (DECISIONES.md #25):
 *   - armar el catálogo de los 4 roles del sistema, estén o no guardados;
 *   - detectar los roles que faltan en la colección "roles";
 *   - validar los datos editables (nombre visible y descripción);
 *   - preparar la creación de un rol faltante con sus valores de fábrica.
 *
 *   Se prueba en Node (scripts/tests/gestionRoles.test.mjs).
 *
 * Depende de: src/config/constantes.js, src/services/errores.js
 * =============================================================
 */

import {
  DESCRIPCIONES_ROL,
  LIMITES_ROL,
  NOMBRES_ROL,
  PERMISOS_POR_ROL,
  ROLES,
} from '../config/constantes.js';
import { ErrorAplicacion } from './errores.js';

/** @typedef {import('../data/modelos.js').Rol} Rol */
/** @typedef {import('../data/modelos.js').Usuario} Usuario */

/**
 * Un rol del sistema tal como lo muestra la pantalla de roles.
 * @typedef {Object} RolDelCatalogo
 * @property {string} clave - Una de ROLES (es el id del documento).
 * @property {boolean} existe - false = falta en la colección "roles" (se puede crear).
 * @property {string} nombre - Guardado o, si falta, el de fábrica.
 * @property {string} descripcion
 * @property {string[]} permisos
 * @property {number} usuariosActivos
 * @property {number} usuariosTotales
 */

/**
 * Valores de fábrica de un rol del sistema.
 * @param {string} clave - Una de ROLES.
 * @returns {{ nombre: string, descripcion: string, permisos: string[] }}
 */
export function rolPorDefecto(clave) {
  return {
    nombre: NOMBRES_ROL[clave],
    descripcion: DESCRIPCIONES_ROL[clave],
    permisos: [...PERMISOS_POR_ROL[clave]],
  };
}

/**
 * Claves de los roles del sistema que no están en la colección "roles".
 * @param {Rol[]} rolesGuardados
 * @returns {string[]}
 */
export function rolesFaltantes(rolesGuardados) {
  const guardadas = new Set(rolesGuardados.map((r) => r.id));
  return Object.values(ROLES).filter((clave) => !guardadas.has(clave));
}

/**
 * Catálogo para la pantalla: siempre los 4 roles del sistema, en el orden de
 * ROLES. Un rol que falta en la base se muestra con sus valores de fábrica y
 * existe = false: los usuarios con ese rol siguen funcionando, porque el rol de
 * cada usuario se valida contra la lista fija de ROLES, no contra la colección.
 * @param {Rol[]} rolesGuardados
 * @param {Usuario[]} usuarios
 * @returns {RolDelCatalogo[]}
 */
export function armarCatalogoRoles(rolesGuardados, usuarios) {
  return Object.values(ROLES).map((clave) => {
    const guardado = rolesGuardados.find((r) => r.id === clave);
    const deFabrica = rolPorDefecto(clave);
    const delRol = usuarios.filter((u) => u.rol === clave);
    return {
      clave,
      existe: Boolean(guardado),
      nombre: guardado?.nombre ?? deFabrica.nombre,
      descripcion: guardado?.descripcion ?? deFabrica.descripcion,
      permisos: guardado?.permisos ?? deFabrica.permisos,
      usuariosActivos: delRol.filter((u) => u.activo).length,
      usuariosTotales: delRol.length,
    };
  });
}

/**
 * Valida y normaliza lo que el admin puede editar de un rol.
 * @param {{ nombre: string, descripcion: string }} datos
 * @returns {{ nombre: string, descripcion: string }}
 * @throws {ErrorAplicacion}
 */
export function validarDatosRol(datos) {
  const nombre = String(datos.nombre ?? '').trim();
  const descripcion = String(datos.descripcion ?? '').trim();
  if (!nombre) throw new ErrorAplicacion('Ingresá el nombre del rol.', 'nombreRolVacio');
  if (nombre.length > LIMITES_ROL.largoMaximoNombre) {
    throw new ErrorAplicacion(`El nombre puede tener hasta ${LIMITES_ROL.largoMaximoNombre} caracteres.`, 'nombreRolLargo');
  }
  if (descripcion.length > LIMITES_ROL.largoMaximoDescripcion) {
    throw new ErrorAplicacion(
      `La descripción puede tener hasta ${LIMITES_ROL.largoMaximoDescripcion} caracteres.`,
      'descripcionRolLarga',
    );
  }
  return { nombre, descripcion };
}

/**
 * Prepara el documento de un rol del sistema que falta en el catálogo.
 *
 * ⚠️ IMPORTANTE: solo se pueden crear los 4 roles del sistema, y únicamente si
 * faltan. Un rol con otra clave no podría hacer nada: el flujo (TRANSICIONES) y
 * firestore.rules solo conocen estos 4. Los permisos son siempre los de fábrica.
 *
 * @param {string} clave - Rol a crear.
 * @param {{ nombre: string, descripcion: string }} datos - Nombre y descripción elegidos.
 * @param {Rol[]} rolesGuardados - Roles que ya están en la colección.
 * @returns {{ nombre: string, descripcion: string, permisos: string[] }}
 * @throws {ErrorAplicacion} Si la clave no es de un rol del sistema o el rol ya existe.
 */
export function prepararRolFaltante(clave, datos, rolesGuardados) {
  if (!Object.values(ROLES).includes(clave)) {
    throw new ErrorAplicacion('Solo se pueden crear los roles del sistema que falten en el catálogo.', 'rolDesconocido');
  }
  if (!rolesFaltantes(rolesGuardados).includes(clave)) {
    throw new ErrorAplicacion(`El rol "${NOMBRES_ROL[clave]}" ya existe en el catálogo.`, 'rolExistente');
  }
  return { ...validarDatosRol(datos), permisos: rolPorDefecto(clave).permisos };
}
