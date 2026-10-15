/**
 * =============================================================
 * Capa: DATOS
 * Archivo: src/data/solicitudesRepositorio.js
 *
 * Responsabilidad:
 *   Leer y escribir solicitudes, su historial y sus adjuntos en Firestore.
 *   NO decide reglas de negocio: las escrituras reciben una función "armar"
 *   del servicio (src/services/solicitudesServicio.js) que calcula qué guardar
 *   a partir de datos frescos leídos dentro de una transacción.
 *
 *   Este archivo se encarga de lo que es de Firestore:
 *   - ids de los documentos nuevos;
 *   - hora del servidor (serverTimestamp);
 *   - 📝 enlazar la solicitud con su evento (ultimoEventoId);
 *   - atomicidad (todo se guarda junto o nada).
 *
 * Depende de: src/config/firebase.js, src/config/constantes.js, src/data/modelos.js
 * =============================================================
 */

import {
  db,
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  orderBy,
  limit,
  runTransaction,
  updateDoc,
  serverTimestamp,
} from '../config/firebase.js';
import { COLECCIONES, LIMITE_BANDEJA, NUMERACION_SOLICITUD } from '../config/constantes.js';

/** @typedef {import('./modelos.js').Solicitud} Solicitud */
/** @typedef {import('./modelos.js').EventoHistorial} EventoHistorial */
/** @typedef {import('./modelos.js').Adjunto} Adjunto */

/**
 * Lo que el servicio devuelve para guardar: campos de la solicitud, el evento
 * principal del historial y (opcional) adjuntos, cada uno con su evento.
 * @typedef {Object} EscrituraSolicitud
 * @property {Object} datos - Campos de la solicitud (completos al crear, solo los que cambian al actualizar).
 * @property {Omit<EventoHistorial, 'id'|'fecha'>} evento - Evento principal; la solicitud apunta a él.
 * @property {{ adjunto: Omit<Adjunto, 'id'|'fechaSubida'>, evento?: Omit<EventoHistorial, 'id'|'fecha'> }[]} [adjuntos]
 */

// -------------------------------------------------------------
// Referencias
// -------------------------------------------------------------

const coleccionSolicitudes = () => collection(db, COLECCIONES.SOLICITUDES);
const refSolicitud = (id) => doc(db, COLECCIONES.SOLICITUDES, id);
const coleccionHistorial = (id) => collection(db, COLECCIONES.SOLICITUDES, id, COLECCIONES.HISTORIAL);
const coleccionAdjuntos = (id) => collection(db, COLECCIONES.SOLICITUDES, id, COLECCIONES.ADJUNTOS);
const refContador = () => doc(db, COLECCIONES.CONTADORES, NUMERACION_SOLICITUD.ID_CONTADOR);

/** Convierte un documento de Firestore en un objeto con su id. */
const conId = (snapshot) => ({ id: snapshot.id, ...snapshot.data() });

// -------------------------------------------------------------
// Lecturas
// -------------------------------------------------------------

/**
 * Obtiene una solicitud por id.
 * @param {string} id
 * @returns {Promise<Solicitud|null>} null si no existe.
 * @throws {FirebaseError} "permission-denied" si el usuario no puede verla.
 */
export async function obtenerSolicitud(id) {
  const snapshot = await getDoc(refSolicitud(id));
  return snapshot.exists() ? /** @type {Solicitud} */ (conId(snapshot)) : null;
}

/**
 * Historial de una solicitud, del más viejo al más nuevo.
 * @param {string} id
 * @returns {Promise<EventoHistorial[]>}
 */
export async function listarHistorial(id) {
  const resultado = await getDocs(query(coleccionHistorial(id), orderBy('fecha', 'asc')));
  return resultado.docs.map(conId);
}

/**
 * Adjuntos de una solicitud (incluye el contenido en base64), del más viejo al más nuevo.
 * @param {string} id
 * @returns {Promise<Adjunto[]>}
 */
export async function listarAdjuntos(id) {
  const resultado = await getDocs(query(coleccionAdjuntos(id), orderBy('fechaSubida', 'asc')));
  return resultado.docs.map(conId);
}

/**
 * Ejecuta una consulta de la bandeja: más recientes primero, con tope de LIMITE_BANDEJA.
 * @param {...import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js').QueryConstraint} filtros
 * @returns {Promise<Solicitud[]>}
 */
async function consultarBandeja(...filtros) {
  const resultado = await getDocs(
    query(coleccionSolicitudes(), ...filtros, orderBy('fechaActualizacion', 'desc'), limit(LIMITE_BANDEJA)),
  );
  return resultado.docs.map(conId);
}

/**
 * Solicitudes asignadas a un usuario (pestañas "Pendientes" y "Nuevas").
 * 🔒 SEGURIDAD: filtra por "asignadoA", un campo que la regla de lectura revisa
 * (las reglas no son filtros: sin este where la consulta se rechaza).
 * ⚠️ IMPORTANTE: filtrar por asignadoA y ordenar por fechaActualizacion requiere
 * el índice compuesto (asignadoA, fechaActualizacion) de firestore.indexes.json.
 * @param {string} uid
 * @returns {Promise<Solicitud[]>} Más recientes primero.
 */
export function listarAsignadasA(uid) {
  return consultarBandeja(where('asignadoA', '==', uid));
}

/**
 * Solicitudes en las que el usuario participa (base de la pestaña "Enviadas").
 * 🔒 SEGURIDAD: filtra por "participantes", un campo que la regla de lectura revisa.
 * ⚠️ IMPORTANTE: requiere el índice compuesto (participantes CONTAINS, fechaActualizacion).
 * @param {string} uid
 * @returns {Promise<Solicitud[]>} Más recientes primero.
 */
export function listarDondeParticipa(uid) {
  return consultarBandeja(where('participantes', 'array-contains', uid));
}

/**
 * Todas las solicitudes (pestaña "Todas", solo RH y admin).
 * 🔒 SEGURIDAD: firestore.rules solo permite esta consulta sin filtro a RH y admin.
 * @returns {Promise<Solicitud[]>} Más recientes primero.
 */
export function listarTodas() {
  return consultarBandeja();
}

// -------------------------------------------------------------
// Escrituras
// -------------------------------------------------------------

/**
 * Agrega al lote de la transacción los adjuntos y sus eventos.
 * @param {import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js').Transaction} transaccion
 * @param {string} idSolicitud
 * @param {EscrituraSolicitud['adjuntos']} adjuntos
 */
function escribirAdjuntos(transaccion, idSolicitud, adjuntos = []) {
  for (const { adjunto, evento } of adjuntos) {
    transaccion.set(doc(coleccionAdjuntos(idSolicitud)), { ...adjunto, fechaSubida: serverTimestamp() });
    if (evento) transaccion.set(doc(coleccionHistorial(idSolicitud)), { ...evento, fecha: serverTimestamp() });
  }
}

/**
 * Crea una solicitud con el siguiente número correlativo.
 *
 * ⚠️ IMPORTANTE: transacción. Lee el contador, le suma 1 y guarda TODO junto:
 * contador, solicitud, evento "creada" y adjuntos. Si otro usuario creó una
 * solicitud en el medio, Firestore reintenta (y vuelve a llamar a "armar"),
 * así que el número nunca se repite.
 *
 * @param {(numeroNuevo: number) => EscrituraSolicitud} armar - Arma la solicitud para ese número (función pura del servicio).
 * @returns {Promise<{ id: string, numero: string }>}
 * @throws {FirebaseError} "permission-denied" si las reglas rechazan algún documento.
 */
export async function crearConNumero(armar) {
  return runTransaction(db, async (transaccion) => {
    const contador = await transaccion.get(refContador());
    const numeroNuevo = (contador.data()?.ultimoNumero ?? 0) + 1;
    const { datos, evento, adjuntos } = armar(numeroNuevo);

    const referencia = doc(coleccionSolicitudes());
    const referenciaEvento = doc(coleccionHistorial(referencia.id));

    transaccion.update(refContador(), { ultimoNumero: numeroNuevo });
    transaccion.set(referencia, {
      ...datos,
      ultimoEventoId: referenciaEvento.id, // 📝 TRAZABILIDAD: la solicitud apunta a su evento "creada"
      fechaCreacion: serverTimestamp(),
      fechaActualizacion: serverTimestamp(),
    });
    transaccion.set(referenciaEvento, { ...evento, fecha: serverTimestamp() });
    escribirAdjuntos(transaccion, referencia.id, adjuntos);

    return { id: referencia.id, numero: datos.numero };
  });
}

/**
 * Actualiza una solicitud registrando el evento correspondiente.
 *
 * ⚠️ IMPORTANTE: transacción. Lee la solicitud FRESCA y se la pasa a "armar",
 * que valida la acción contra su estado real. Si dos personas actúan a la vez,
 * la segunda ve el estado ya cambiado y recibe un error claro.
 *
 * @param {string} id
 * @param {(solicitudActual: Solicitud) => EscrituraSolicitud} armar
 * @returns {Promise<void>}
 * @throws {Error} Si la solicitud no existe, o el error de validación que lance "armar".
 * @throws {FirebaseError} "permission-denied" si las reglas rechazan la escritura.
 */
export async function actualizarConEvento(id, armar) {
  await runTransaction(db, async (transaccion) => {
    const snapshot = await transaccion.get(refSolicitud(id));
    if (!snapshot.exists()) throw new Error('La solicitud no existe.');
    const { datos, evento, adjuntos } = armar(/** @type {Solicitud} */ (conId(snapshot)));

    const referenciaEvento = doc(coleccionHistorial(id));
    transaccion.update(refSolicitud(id), {
      ...datos,
      ultimoEventoId: referenciaEvento.id, // 📝 TRAZABILIDAD: ningún cambio sin su evento
      fechaActualizacion: serverTimestamp(),
    });
    transaccion.set(referenciaEvento, { ...evento, fecha: serverTimestamp() });
    escribirAdjuntos(transaccion, id, adjuntos);
  });
}

/**
 * Marca la solicitud como vista por su asignado (alimenta la pestaña "Nuevas").
 * Es el único cambio que no registra evento: no es una acción sobre el trámite.
 * @param {string} id
 * @returns {Promise<void>}
 */
export function marcarComoVista(id) {
  return updateDoc(refSolicitud(id), { vistaPorAsignado: true, fechaActualizacion: serverTimestamp() });
}
