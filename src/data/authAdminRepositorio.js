/**
 * =============================================================
 * Capa: DATOS
 * Archivo: src/data/authAdminRepositorio.js
 *
 * Responsabilidad:
 *   Operaciones de Firebase Authentication sobre cuentas de OTROS usuarios,
 *   que hace el admin desde el mantenimiento:
 *   - crear la cuenta de acceso de un usuario nuevo;
 *   - comprobar una cuenta que ya existe (para completar un alta interrumpida);
 *   - enviar el mail para que el usuario elija una contraseña nueva.
 *
 *   Las dos primeras usan la instancia SECUNDARIA de Firebase (obtenerAuthAltas):
 *   la sesión del admin, en la instancia principal, no se toca (DECISIONES.md #14).
 *
 * Depende de: src/config/firebase.js
 * =============================================================
 */

import {
  auth,
  obtenerAuthAltas,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from '../config/firebase.js';

/**
 * Crea la cuenta de acceso (email y contraseña) de un usuario nuevo.
 * @param {string} email
 * @param {string} contrasena - Contraseña inicial.
 * @returns {Promise<string>} uid de la cuenta creada.
 * @throws {import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js').FirebaseError}
 *   Por ejemplo "auth/email-already-in-use" o "auth/weak-password".
 */
export async function crearCuentaDeAcceso(email, contrasena) {
  const authAltas = obtenerAuthAltas();
  try {
    const credencial = await createUserWithEmailAndPassword(authAltas, email, contrasena);
    return credencial.user.uid;
  } finally {
    // La cuenta nueva quedó logueada en la instancia secundaria: se la cierra.
    await signOut(authAltas);
  }
}

/**
 * Comprueba que una cuenta existente tenga esa contraseña y devuelve su uid.
 * Sirve para completar un alta que se cortó después de crear la cuenta en Auth
 * y antes de guardar el perfil.
 * @param {string} email
 * @param {string} contrasena
 * @returns {Promise<string>} uid de la cuenta.
 * @throws {import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js').FirebaseError}
 *   "auth/invalid-credential" si la contraseña no coincide.
 */
export async function verificarCuentaDeAcceso(email, contrasena) {
  const authAltas = obtenerAuthAltas();
  try {
    const credencial = await signInWithEmailAndPassword(authAltas, email, contrasena);
    return credencial.user.uid;
  } finally {
    await signOut(authAltas);
  }
}

/**
 * Envía al usuario el mail de Firebase para elegir una contraseña nueva.
 * No cambia ninguna sesión: el admin nunca conoce la contraseña nueva.
 * @param {string} email
 * @returns {Promise<void>}
 * @throws {import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js').FirebaseError}
 */
export function enviarCorreoDeContrasena(email) {
  return sendPasswordResetEmail(auth, email);
}
