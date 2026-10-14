/**
 * =============================================================
 * Capa: DATOS
 * Archivo: src/data/authRepositorio.js
 *
 * Responsabilidad:
 *   Envolver las llamadas a Firebase Authentication. No toma decisiones de
 *   negocio (eso lo hace src/services/authServicio.js): solo ejecuta.
 *   Así la UI y los servicios no dependen directamente del SDK.
 *
 * Depende de: src/config/firebase.js
 * =============================================================
 */

import {
  auth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from '../config/firebase.js';

/**
 * Inicia sesión en Firebase Auth con email y contraseña.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<string>} uid del usuario autenticado.
 * @throws {import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js').FirebaseError}
 *   Error de Firebase con código "auth/..." (credenciales inválidas, red, etc.).
 */
export async function autenticar(email, password) {
  const credencial = await signInWithEmailAndPassword(auth, email, password);
  return credencial.user.uid;
}

/**
 * Cierra la sesión actual en Firebase Auth.
 * @returns {Promise<void>}
 */
export function desautenticar() {
  return signOut(auth);
}

/**
 * Escucha los cambios de sesión (login, logout y sesión recordada al recargar la página).
 * @param {(uid: string|null) => void} callback - Recibe el uid, o null si no hay sesión.
 * @returns {() => void} Función para dejar de escuchar.
 */
export function escucharCambiosDeSesion(callback) {
  return onAuthStateChanged(auth, (usuarioAuth) => callback(usuarioAuth ? usuarioAuth.uid : null));
}
