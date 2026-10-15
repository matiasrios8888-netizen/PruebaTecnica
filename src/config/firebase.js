/**
 * =============================================================
 * Capa: CONFIGURACIÓN
 * Archivo: src/config/firebase.js
 *
 * Responsabilidad:
 *   - Inicializar la app de Firebase con la configuración del proyecto.
 *   - Exportar las instancias de Authentication (auth) y Firestore (db).
 *   - Reexportar las funciones del SDK que usa la app, para que la URL del
 *     CDN y la versión de Firebase estén definidas en un ÚNICO lugar.
 *
 * Depende de: SDK modular de Firebase servido por el CDN oficial (gstatic).
 * La usan: los repositorios (src/data/) y, en la Fase 4, el alta de usuarios.
 * =============================================================
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

/**
 * Configuración pública del proyecto Firebase.
 *
 * 🔒 SEGURIDAD: estos valores NO son secretos. Identifican el proyecto y
 * cualquier usuario los ve en el navegador. Lo que protege los datos son
 * las reglas de Firestore (firestore.rules) y la autenticación, no ocultar
 * esta configuración. La clave privada de la cuenta de servicio, en cambio,
 * sí es secreta y nunca entra al código del navegador.
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyCTvgMFNczWVFkaXt3VjUYAWwJaSGxQ2vc',
  authDomain: 'pruebatecnica-2002c.firebaseapp.com',
  projectId: 'pruebatecnica-2002c',
  storageBucket: 'pruebatecnica-2002c.firebasestorage.app',
  messagingSenderId: '1070382813544',
  appId: '1:1070382813544:web:721156edaa84ebf2a086dd',
};

/** Instancia principal de Firebase (la sesión del usuario logueado vive acá). */
export const app = initializeApp(firebaseConfig);

/** Servicio de Authentication (login con email y contraseña). */
export const auth = getAuth(app);

/** Base de datos Firestore. */
export const db = getFirestore(app);

// Funciones del SDK que usan las capas de datos y servicios.
// Se agregan acá a medida que se necesitan, siempre con la misma versión.
export {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';

export {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  orderBy,
  runTransaction,
  updateDoc,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
