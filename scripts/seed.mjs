/**
 * =============================================================
 * Script de datos de prueba – EJECUCIÓN
 * Archivo: scripts/seed.mjs
 *
 * Responsabilidad:
 *   Cargar en Firebase los datos de scripts/datosPrueba.mjs:
 *   1. Crea (o actualiza) los usuarios de prueba en Firebase Authentication.
 *   2. Escribe sus perfiles en "usuarios" y el catálogo de "roles".
 *   3. Borra todas las solicitudes (con su historial y adjuntos) y las vuelve
 *      a crear recorriendo el guion de cada una con la tabla TRANSICIONES.
 *   4. Deja el contador de numeración (contadores/solicitudes) en la última usada.
 *   Es idempotente: correrlo varias veces deja siempre el mismo resultado.
 *
 * Uso (desde la carpeta scripts/):
 *   npm install            → instala firebase-admin (solo la primera vez)
 *   npm run seed:simular   → valida todo y prueba la conexión SIN escribir nada
 *   npm run seed           → carga los datos
 *
 * Depende de: firebase-admin, scripts/datosPrueba.mjs, src/config/constantes.js,
 *   scripts/serviceAccountKey.json (clave privada, ignorada por git).
 *
 * 🔒 SEGURIDAD: firebase-admin usa la clave de cuenta de servicio y SALTEA las
 *   reglas de Firestore (tiene acceso total). Por eso corre solo en la PC del
 *   desarrollador y la clave nunca se sube al repositorio ni al sitio publicado.
 * =============================================================
 */

import { readFile } from 'node:fs/promises';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';

import {
  COLECCIONES,
  NUMERACION_SOLICITUD,
  ROLES,
  NOMBRES_ROL,
  PERMISOS_POR_ROL,
  ESTADOS,
  ESTADOS_FINALES,
  EJECUTORES,
  ACCIONES,
  ACCIONES_HISTORIAL,
  TRANSICIONES,
  CONFIG_TIPOS_PERMISO,
} from '../src/config/constantes.js';
import {
  PASO_NOTA,
  PASO_ADJUNTO,
  PASSWORD_PRUEBA,
  USUARIOS_PRUEBA,
  DESCRIPCIONES_ROL,
  SOLICITUDES_PRUEBA,
} from './datosPrueba.mjs';

/** Proyecto en el que se permite escribir (evita cargar datos en otro proyecto por error). */
const PROYECTO_ESPERADO = 'pruebatecnica-2002c';
const RUTA_CLAVE = new URL('./serviceAccountKey.json', import.meta.url);
const MODO_SIMULACION = process.argv.includes('--simular');
const MS_POR_HORA = 60 * 60 * 1000;
const MS_POR_DIA = 24 * MS_POR_HORA;

// -------------------------------------------------------------
// Utilidades
// -------------------------------------------------------------

/**
 * Lee la clave de cuenta de servicio y verifica que sea del proyecto esperado.
 * @returns {Promise<object>} Contenido de la clave.
 * @throws {Error} Si el archivo no existe o es de otro proyecto.
 */
async function leerClave() {
  let clave;
  try {
    clave = JSON.parse(await readFile(RUTA_CLAVE, 'utf8'));
  } catch {
    throw new Error(
      'No se encontró scripts/serviceAccountKey.json. Descargala desde la consola de Firebase: ' +
        'Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada.',
    );
  }
  if (clave.project_id !== PROYECTO_ESPERADO) {
    throw new Error(`La clave es del proyecto "${clave.project_id}", se esperaba "${PROYECTO_ESPERADO}".`);
  }
  return clave;
}

/**
 * Formatea una fecha como "AAAA-MM-DD" (día calendario, sin hora).
 * @param {Date} fecha
 * @returns {string}
 */
function aFechaCalendario(fecha) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

/**
 * Arma un PDF mínimo y válido de una página con un título, para usar como adjunto de prueba.
 * (Solo texto ASCII: la fuente estándar Helvetica sin codificación extra no tiene tildes.)
 * @param {string} titulo
 * @returns {Buffer} Bytes del PDF.
 */
function crearPdfDePrueba(titulo) {
  const texto = `${titulo} - documento de prueba`.replace(/[()\\]/g, '');
  const contenido = `BT /F1 18 Tf 72 760 Td (${texto}) Tj ET`;
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  // Un PDF termina con una tabla (xref) que indica en qué byte empieza cada objeto.
  let pdf = '%PDF-1.4\n';
  const posiciones = objetos.map((cuerpo, i) => {
    const posicion = pdf.length;
    pdf += `${i + 1} 0 obj\n${cuerpo}\nendobj\n`;
    return posicion;
  });
  const inicioXref = pdf.length;
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  pdf += posiciones.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

// -------------------------------------------------------------
// Construcción de una solicitud a partir de su guion
// -------------------------------------------------------------

/**
 * Recorre el guion de una solicitud aplicando la tabla TRANSICIONES y arma
 * el documento final, los eventos del historial y los adjuntos.
 *
 * ⚠️ IMPORTANTE: cada acción se valida igual que lo hará la app (estado de
 * origen, rol, ejecutor y comentario obligatorio). Si el guion tiene un paso
 * imposible, el script falla en lugar de cargar datos incoherentes.
 *
 * @param {object} guion - Un elemento de SOLICITUDES_PRUEBA.
 * @param {string} numero - Número legible (ej: "SOL-0001").
 * @param {Record<string, {uid: string, nombre: string, rol: string, supervisor: string|null}>} usuarios
 * @param {Date} ahora - Momento de referencia para las fechas relativas.
 * @returns {{ solicitud: object, eventos: object[], adjuntos: object[] }}
 * @throws {Error} Si algún paso del guion no cumple las reglas del flujo.
 */
function construirSolicitud(guion, numero, usuarios, ahora) {
  const solicitante = usuarios[ROLES.INICIADOR];
  const configTipo = CONFIG_TIPOS_PERMISO[guion.tipoPermiso];
  const fallar = (mensaje) => {
    throw new Error(`${numero}: ${mensaje}`);
  };

  if (!configTipo) fallar(`tipo de permiso desconocido "${guion.tipoPermiso}"`);
  if (guion.cantidadDias > configTipo.diasMaximos) {
    fallar(`${configTipo.nombre} admite como máximo ${configTipo.diasMaximos} días`);
  }

  // Fecha de creación: N días atrás a las 9:30.
  let fechaActual = new Date(ahora.getTime() - guion.creadaHaceDias * MS_POR_DIA);
  fechaActual.setHours(9, 30, 0, 0);
  const fechaCreacion = new Date(fechaActual);

  const fechaInicio = new Date(fechaCreacion.getTime() + guion.inicioEnDias * MS_POR_DIA);
  const fechaFin = new Date(fechaInicio.getTime() + (guion.cantidadDias - 1) * MS_POR_DIA);

  const estado = { estadoActual: null, etapaActual: null, asignado: null };
  const participantes = new Set([solicitante.uid]);
  const eventos = [];
  const adjuntos = [];
  let cantidadNotas = 0;

  /** ⚠️ IMPORTANTE: a quién le toca actuar según el estado nuevo. */
  const resolverAsignado = (estadoNuevo) => {
    if (estadoNuevo === ESTADOS.EN_APROBACION) return usuarios[solicitante.supervisor];
    if (estadoNuevo === ESTADOS.DEVUELTA) return solicitante;
    if (estadoNuevo === ESTADOS.EN_GESTION_RH) return usuarios[ROLES.RH]; // único usuario RH de prueba
    return null; // estados finales
  };

  /** 📝 TRAZABILIDAD: arma un evento del historial con la forma de EventoHistorial. */
  const registrarEvento = (accion, actor, cambio, comentario) => {
    if (fechaActual > ahora) fallar('el guion genera un evento en el futuro; reducí las horas');
    eventos.push({
      accion,
      usuarioId: actor.uid,
      usuarioNombre: actor.nombre,
      rolUsuario: actor.rol,
      fecha: Timestamp.fromDate(fechaActual),
      estadoAnterior: cambio?.estadoAnterior ?? null,
      estadoNuevo: cambio?.estadoNuevo ?? null,
      etapaAnterior: cambio?.etapaAnterior ?? null,
      etapaNueva: cambio?.etapaNueva ?? null,
      comentario: comentario ?? '',
    });
  };

  const aplicarAccion = (accion, actor, comentario) => {
    const transicion = TRANSICIONES[accion];
    if (!transicion) fallar(`acción desconocida "${accion}"`);

    const estadoValido =
      transicion.estadosOrigen.length === 0
        ? estado.estadoActual === null
        : transicion.estadosOrigen.includes(estado.estadoActual);
    if (!estadoValido) fallar(`no se puede "${accion}" desde el estado "${estado.estadoActual}"`);
    if (actor.rol !== transicion.rolRequerido) fallar(`"${accion}" requiere rol "${transicion.rolRequerido}"`);
    if (transicion.ejecutor === EJECUTORES.ASIGNADO && actor.uid !== estado.asignado?.uid) {
      fallar(`"${accion}" solo la puede hacer el usuario asignado`);
    }
    if (transicion.ejecutor === EJECUTORES.SOLICITANTE && actor.uid !== solicitante.uid) {
      fallar(`"${accion}" solo la puede hacer el solicitante`);
    }
    if (transicion.requiereComentario && !comentario?.trim()) fallar(`"${accion}" requiere un comentario`);

    registrarEvento(
      transicion.accionHistorial,
      actor,
      {
        estadoAnterior: estado.estadoActual,
        estadoNuevo: transicion.estadoNuevo,
        etapaAnterior: estado.etapaActual,
        etapaNueva: transicion.etapaNueva,
      },
      comentario,
    );

    estado.estadoActual = transicion.estadoNuevo;
    estado.etapaActual = transicion.etapaNueva;
    estado.asignado = resolverAsignado(transicion.estadoNuevo);
    participantes.add(actor.uid);
    if (estado.asignado) participantes.add(estado.asignado.uid);
  };

  const agregarAdjunto = (archivo, actor) => {
    const contenido = crearPdfDePrueba(archivo.titulo);
    adjuntos.push({
      nombreArchivo: archivo.nombreArchivo,
      tipoMime: 'application/pdf',
      tamanoBytes: contenido.length,
      contenidoBase64: contenido.toString('base64'),
      subidoPor: actor.uid,
      subidoPorNombre: actor.nombre,
      fechaSubida: Timestamp.fromDate(fechaActual),
    });
    registrarEvento(ACCIONES_HISTORIAL.ADJUNTO_AGREGADO, actor, null, archivo.nombreArchivo);
    participantes.add(actor.uid);
  };

  // 1. Creación y adjuntos iniciales (un minuto después cada uno).
  aplicarAccion(ACCIONES.CREAR, solicitante, '');
  for (const archivo of guion.adjuntosIniciales) {
    fechaActual = new Date(fechaActual.getTime() + 60 * 1000);
    agregarAdjunto(archivo, solicitante);
  }
  if (configTipo.requiereAdjunto && adjuntos.length === 0) {
    fallar(`${configTipo.nombre} requiere al menos un adjunto`);
  }

  // 2. Pasos del guion, en orden.
  for (const paso of guion.pasos) {
    fechaActual = new Date(fechaActual.getTime() + paso.horas * MS_POR_HORA);
    const actor = usuarios[paso.por];
    if (paso.accion === PASO_NOTA) {
      registrarEvento(ACCIONES_HISTORIAL.NOTA_AGREGADA, actor, null, paso.comentario);
      participantes.add(actor.uid);
      cantidadNotas += 1;
    } else if (paso.accion === PASO_ADJUNTO) {
      agregarAdjunto(paso.archivo, actor);
    } else {
      aplicarAccion(paso.accion, actor, paso.comentario);
    }
  }

  const esFinal = ESTADOS_FINALES.includes(estado.estadoActual);
  const solicitud = {
    numero,
    tipoPermiso: guion.tipoPermiso,
    fechaInicio: aFechaCalendario(fechaInicio),
    fechaFin: aFechaCalendario(fechaFin),
    cantidadDias: guion.cantidadDias,
    motivo: guion.motivo,
    solicitanteId: solicitante.uid,
    solicitanteNombre: solicitante.nombre,
    supervisorId: usuarios[solicitante.supervisor].uid,
    etapaActual: estado.etapaActual,
    estadoActual: estado.estadoActual,
    asignadoA: estado.asignado?.uid ?? null,
    asignadoNombre: estado.asignado?.nombre ?? null,
    rolAsignado: estado.asignado?.rol ?? null,
    vistaPorAsignado: esFinal ? true : Boolean(guion.vistaPorAsignado),
    participantes: [...participantes],
    cantidadAdjuntos: adjuntos.length,
    cantidadNotas,
    fechaCreacion: Timestamp.fromDate(fechaCreacion),
    fechaActualizacion: Timestamp.fromDate(fechaActual),
  };

  return { solicitud, eventos, adjuntos };
}

// -------------------------------------------------------------
// Escritura en Firebase
// -------------------------------------------------------------

/**
 * Crea los usuarios en Firebase Auth, o los actualiza si ya existen (mismo email).
 * @param {import('firebase-admin/auth').Auth} auth
 * @returns {Promise<Record<string, object>>} Usuarios de prueba con su uid, por clave.
 */
async function prepararUsuariosAuth(auth) {
  const resultado = {};
  for (const [clave, datos] of Object.entries(USUARIOS_PRUEBA)) {
    const propiedades = { email: datos.email, password: PASSWORD_PRUEBA, displayName: datos.nombre, disabled: false };
    let uid;
    try {
      uid = (await auth.getUserByEmail(datos.email)).uid;
      await auth.updateUser(uid, propiedades);
      console.log(`  ↻ Auth: ${datos.email} (ya existía, actualizado)`);
    } catch (error) {
      if (error.code !== 'auth/user-not-found') throw error;
      uid = (await auth.createUser(propiedades)).uid;
      console.log(`  + Auth: ${datos.email} (creado)`);
    }
    resultado[clave] = { ...datos, uid };
  }
  return resultado;
}

/**
 * Escribe los perfiles de "usuarios" y el catálogo de "roles".
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {Record<string, object>} usuarios
 */
async function escribirUsuariosYRoles(db, usuarios) {
  const lote = db.batch();
  for (const usuario of Object.values(usuarios)) {
    lote.set(db.collection(COLECCIONES.USUARIOS).doc(usuario.uid), {
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
      supervisorId: usuario.supervisor ? usuarios[usuario.supervisor].uid : null,
      area: usuario.area,
      activo: true,
      fechaCreacion: FieldValue.serverTimestamp(),
      fechaActualizacion: FieldValue.serverTimestamp(),
    });
  }
  for (const rol of Object.values(ROLES)) {
    lote.set(db.collection(COLECCIONES.ROLES).doc(rol), {
      nombre: NOMBRES_ROL[rol],
      descripcion: DESCRIPCIONES_ROL[rol],
      permisos: PERMISOS_POR_ROL[rol],
      activo: true,
    });
  }
  await lote.commit();
  console.log(`  ✔ ${Object.keys(usuarios).length} perfiles en "usuarios" y ${Object.values(ROLES).length} roles`);
}

/**
 * Borra todas las solicitudes (con sus subcolecciones), escribe las nuevas y
 * deja el contador de numeración en la última usada.
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {{ solicitud: object, eventos: object[], adjuntos: object[] }[]} construidas
 */
async function reemplazarSolicitudes(db, construidas) {
  const coleccion = db.collection(COLECCIONES.SOLICITUDES);
  // recursiveDelete borra también historial y adjuntos (en Firestore, borrar un
  // documento NO borra sus subcolecciones automáticamente).
  await db.recursiveDelete(coleccion);
  console.log('  ✔ Solicitudes anteriores borradas');

  // Un writeBatch por solicitud: el documento, su historial y sus adjuntos se
  // guardan juntos o no se guarda nada.
  for (const { solicitud, eventos, adjuntos } of construidas) {
    const lote = db.batch();
    const referencia = coleccion.doc();
    const referenciasEventos = eventos.map(() => referencia.collection(COLECCIONES.HISTORIAL).doc());
    // 📝 TRAZABILIDAD: la solicitud apunta a su último evento, igual que exigen las reglas.
    lote.set(referencia, { ...solicitud, ultimoEventoId: referenciasEventos.at(-1).id });
    eventos.forEach((evento, i) => lote.set(referenciasEventos[i], evento));
    for (const adjunto of adjuntos) lote.set(referencia.collection(COLECCIONES.ADJUNTOS).doc(), adjunto);
    await lote.commit();
  }
  console.log(`  ✔ ${construidas.length} solicitudes creadas con su historial y adjuntos`);

  // La próxima solicitud que se cree desde la app toma el número siguiente.
  await db
    .collection(COLECCIONES.CONTADORES)
    .doc(NUMERACION_SOLICITUD.ID_CONTADOR)
    .set({ ultimoNumero: construidas.length });
  console.log(`  ✔ Contador de numeración en ${construidas.length}`);
}

// -------------------------------------------------------------
// Programa principal
// -------------------------------------------------------------

async function main() {
  console.log(MODO_SIMULACION ? '🧪 MODO SIMULACIÓN (no se escribe nada)\n' : '🌱 Cargando datos de prueba\n');

  const clave = await leerClave();
  initializeApp({ credential: cert(clave) });
  const auth = getAuth();
  const db = getFirestore();

  let usuarios;
  if (MODO_SIMULACION) {
    // Se prueba el acceso con lecturas que no modifican nada.
    await auth.listUsers(1);
    console.log('  ✔ Conexión con Authentication');
    await db.listCollections();
    console.log('  ✔ Conexión con Firestore (la base de datos existe)');
    // uids ficticios: alcanzan para validar los guiones.
    usuarios = Object.fromEntries(
      Object.entries(USUARIOS_PRUEBA).map(([k, datos]) => [k, { ...datos, uid: `uid-${k}` }]),
    );
  } else {
    console.log('1) Usuarios en Authentication');
    usuarios = await prepararUsuariosAuth(auth);
    console.log('2) Perfiles y roles en Firestore');
    await escribirUsuariosYRoles(db, usuarios);
  }

  const ahora = new Date();
  const construidas = SOLICITUDES_PRUEBA.map((guion, i) =>
    construirSolicitud(guion, `SOL-${String(i + 1).padStart(4, '0')}`, usuarios, ahora),
  );
  console.log(`  ✔ ${construidas.length} guiones de solicitudes válidos según TRANSICIONES`);

  if (!MODO_SIMULACION) {
    console.log('3) Solicitudes');
    await reemplazarSolicitudes(db, construidas);
  }

  console.log('\nResumen:');
  console.table(
    construidas.map(({ solicitud, eventos }) => ({
      numero: solicitud.numero,
      tipo: solicitud.tipoPermiso,
      estado: solicitud.estadoActual,
      etapa: solicitud.etapaActual,
      asignado: solicitud.asignadoNombre ?? '—',
      nueva: solicitud.asignadoA ? !solicitud.vistaPorAsignado : '—',
      eventos: eventos.length,
      adjuntos: solicitud.cantidadAdjuntos,
    })),
  );
  console.log('Usuarios de prueba (contraseña común):', PASSWORD_PRUEBA);
  for (const u of Object.values(USUARIOS_PRUEBA)) console.log(`  ${u.rol.padEnd(10)} ${u.email}`);
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  if (error.code === 5 || /NOT_FOUND/.test(error.message)) {
    console.error('   ¿Creaste la base de datos Firestore en la consola de Firebase?');
  }
  process.exitCode = 1;
});
