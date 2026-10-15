// TEMPORAL (no se commitea): prepara y limpia escenarios de prueba de la Fase 4.
// Uso: node tmp-prueba-fase4.mjs crear-cuenta-sin-perfil | borrar-usuarios-prueba | borrar-rol <clave>
import { readFile } from 'node:fs/promises';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const clave = JSON.parse(await readFile(new URL('./serviceAccountKey.json', import.meta.url), 'utf8'));
initializeApp({ credential: cert(clave) });
const auth = getAuth();
const db = getFirestore();
const [orden, argumento] = process.argv.slice(2);

const EMAILS_PRUEBA = ['lucia.torres@bprosys.test', 'alta.interrumpida@bprosys.test'];

if (orden === 'crear-cuenta-sin-perfil') {
  const { uid } = await auth.createUser({ email: 'alta.interrumpida@bprosys.test', password: 'Inicial2026' });
  console.log('Cuenta de Auth sin perfil creada:', uid);
} else if (orden === 'borrar-usuarios-prueba') {
  for (const email of EMAILS_PRUEBA) {
    try {
      const { uid } = await auth.getUserByEmail(email);
      await auth.deleteUser(uid);
      await db.collection('usuarios').doc(uid).delete();
      console.log('Borrado:', email);
    } catch (error) {
      console.log('No existía:', email, error.code ?? '');
    }
  }
} else if (orden === 'borrar-rol') {
  await db.collection('roles').doc(argumento).delete();
  console.log('Rol borrado:', argumento);
} else {
  console.log('Orden desconocida');
}
