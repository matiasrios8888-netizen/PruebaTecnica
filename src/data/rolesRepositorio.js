/**
 * =============================================================
 * Capa: DATOS
 * Archivo: src/data/rolesRepositorio.js
 *
 * Responsabilidad:
 *   Leer y escribir el catálogo de roles (colección "roles"; el id de cada
 *   documento es la clave del rol). Las reglas de negocio están en
 *   src/services/gestionRoles.js y la seguridad en firestore.rules.
 *
 * Depende de: src/config/firebase.js, src/config/constantes.js, src/data/modelos.js
 * =============================================================
 */

import { db, doc, getDocs, setDoc, updateDoc, collection } from '../config/firebase.js';
import { COLECCIONES } from '../config/constantes.js';

/** @typedef {import('./modelos.js').Rol} Rol */

/**
 * Lista los roles guardados (pueden faltar algunos de los 4 del sistema).
 * @returns {Promise<Rol[]>}
 * @throws {import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js').FirebaseError}
 */
export async function listarRoles() {
  const resultado = await getDocs(collection(db, COLECCIONES.ROLES));
  return resultado.docs.map((d) => /** @type {Rol} */ ({ id: d.id, ...d.data() }));
}

/**
 * Crea un rol del sistema que falta en el catálogo.
 * 🔒 SEGURIDAD: firestore.rules solo lo permite al admin, para las 4 claves del
 * sistema y con sus permisos de fábrica.
 * @param {string} clave - Una de ROLES.
 * @param {Omit<Rol, 'id'>} datos
 * @returns {Promise<void>}
 * @throws {import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js').FirebaseError}
 */
export function crearRol(clave, datos) {
  return setDoc(doc(db, COLECCIONES.ROLES, clave), datos);
}

/**
 * Actualiza el nombre y la descripción de un rol.
 * 🔒 SEGURIDAD: firestore.rules rechaza cualquier cambio en "permisos".
 * @param {string} clave
 * @param {{ nombre: string, descripcion: string }} cambios
 * @returns {Promise<void>}
 * @throws {import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js').FirebaseError}
 */
export function actualizarRol(clave, cambios) {
  return updateDoc(doc(db, COLECCIONES.ROLES, clave), cambios);
}
