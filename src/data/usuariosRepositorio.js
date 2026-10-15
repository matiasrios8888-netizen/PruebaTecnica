/**
 * =============================================================
 * Capa: DATOS
 * Archivo: src/data/usuariosRepositorio.js
 *
 * Responsabilidad:
 *   Leer y escribir documentos de la colección "usuarios" en Firestore.
 *   Convierte los documentos de Firestore en objetos Usuario (ver modelos.js).
 *
 * Depende de: src/config/firebase.js, src/config/constantes.js, src/data/modelos.js
 * =============================================================
 */

import {
  db,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  serverTimestamp,
} from '../config/firebase.js';
import { COLECCIONES } from '../config/constantes.js';

/** @typedef {import('./modelos.js').Usuario} Usuario */

/**
 * Obtiene el perfil de un usuario por su uid.
 * @param {string} uid - uid de Firebase Auth (es el id del documento).
 * @returns {Promise<Usuario|null>} El usuario, o null si no tiene perfil en Firestore.
 * @throws {import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js').FirebaseError}
 *   Por ejemplo "permission-denied" si las reglas no permiten la lectura.
 */
export async function obtenerUsuarioPorId(uid) {
  const snapshot = await getDoc(doc(db, COLECCIONES.USUARIOS, uid));
  if (!snapshot.exists()) return null;
  return /** @type {Usuario} */ ({ id: snapshot.id, ...snapshot.data() });
}

/**
 * Lista todos los usuarios (activos e inactivos), ordenados por nombre.
 * Es el directorio de la empresa: alcanza con una lectura para el mantenimiento.
 * @returns {Promise<Usuario[]>}
 * @throws {import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js').FirebaseError}
 */
export async function listarUsuarios() {
  const resultado = await getDocs(query(collection(db, COLECCIONES.USUARIOS), orderBy('nombre')));
  return resultado.docs.map((d) => /** @type {Usuario} */ ({ id: d.id, ...d.data() }));
}

/**
 * Crea el perfil de un usuario nuevo (el id del documento es el uid de su cuenta de Auth).
 * 🔒 SEGURIDAD: firestore.rules solo permite crear perfiles al admin, y siempre activos.
 * @param {string} uid
 * @param {Omit<Usuario, 'id'|'fechaCreacion'|'fechaActualizacion'>} datos
 * @returns {Promise<void>}
 * @throws {import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js').FirebaseError}
 */
export function crearPerfil(uid, datos) {
  return setDoc(doc(db, COLECCIONES.USUARIOS, uid), {
    ...datos,
    fechaCreacion: serverTimestamp(),
    fechaActualizacion: serverTimestamp(),
  });
}

/**
 * Actualiza campos del perfil de un usuario (edición, baja o reactivación).
 * @param {string} uid
 * @param {Partial<Usuario>} cambios - Solo los campos que cambian.
 * @returns {Promise<void>}
 * @throws {import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js').FirebaseError}
 */
export function actualizarPerfil(uid, cambios) {
  return updateDoc(doc(db, COLECCIONES.USUARIOS, uid), { ...cambios, fechaActualizacion: serverTimestamp() });
}

/**
 * Lista los usuarios que tienen un rol (activos e inactivos).
 * Se usa, por ejemplo, para el reparto rotativo de RH al aprobar.
 * @param {string} rol - Una de ROLES.
 * @returns {Promise<Usuario[]>}
 * @throws {import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js').FirebaseError}
 */
export async function listarUsuariosPorRol(rol) {
  const resultado = await getDocs(query(collection(db, COLECCIONES.USUARIOS), where('rol', '==', rol)));
  return resultado.docs.map((d) => /** @type {Usuario} */ ({ id: d.id, ...d.data() }));
}
