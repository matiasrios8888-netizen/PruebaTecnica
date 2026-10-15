/**
 * =============================================================
 * Tests de SEGURIDAD: reglas de Firestore
 * Archivo: scripts/tests/reglas.test.mjs
 *
 * Responsabilidad:
 *   Comprobar que firestore.rules permite lo que corresponde y rechaza lo
 *   que no, simulando usuarios de cada rol contra el EMULADOR de Firestore
 *   (una copia local de la base). Nunca toca el proyecto real.
 *
 * Uso (desde scripts/):  npm run test:reglas
 *   Levanta el emulador con el proyecto ficticio "demo-permisos", corre los
 *   tests y lo apaga. Requiere Java y Firebase CLI.
 *
 * Depende de: @firebase/rules-unit-testing, firebase (SDK cliente), firestore.rules
 * =============================================================
 */

import { describe, test, before, after, beforeEach } from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

// -------------------------------------------------------------
// Datos de partida
// -------------------------------------------------------------

const PERFILES = {
  ini: { nombre: 'Ana Gómez', rol: 'iniciador', supervisorId: 'sup', activo: true },
  sup: { nombre: 'Carlos Pérez', rol: 'supervisor', supervisorId: null, activo: true },
  rh: { nombre: 'Laura Fernández', rol: 'rh', supervisorId: null, activo: true },
  admin: { nombre: 'Martín Sosa', rol: 'admin', supervisorId: null, activo: true },
  otroIni: { nombre: 'Pedro Ruiz', rol: 'iniciador', supervisorId: 'otroSup', activo: true },
  otroSup: { nombre: 'Sofía Díaz', rol: 'supervisor', supervisorId: null, activo: true },
  inactivo: { nombre: 'Juan Baja', rol: 'iniciador', supervisorId: 'sup', activo: false },
};

/** Solicitud en "enAprobacion" de "ini", asignada a su supervisor "sup". */
function solicitudBase(cambios = {}) {
  return {
    numero: 'SOL-0001',
    tipoPermiso: 'vacaciones',
    fechaInicio: '2026-11-03',
    fechaFin: '2026-11-07',
    cantidadDias: 5,
    motivo: 'Viaje familiar',
    solicitanteId: 'ini',
    solicitanteNombre: 'Ana Gómez',
    supervisorId: 'sup',
    etapaActual: 'aprobacion',
    estadoActual: 'enAprobacion',
    asignadoA: 'sup',
    asignadoNombre: 'Carlos Pérez',
    rolAsignado: 'supervisor',
    vistaPorAsignado: false,
    participantes: ['ini', 'sup'],
    cantidadAdjuntos: 0,
    cantidadNotas: 0,
    fechaCreacion: Timestamp.now(),
    fechaActualizacion: Timestamp.now(),
    ...cambios,
  };
}

/** Evento del historial firmado por "uid" (fecha del servidor). */
function evento(uid, accion, cambio = {}, comentario = '') {
  return {
    accion,
    usuarioId: uid,
    usuarioNombre: PERFILES[uid].nombre,
    rolUsuario: PERFILES[uid].rol,
    fecha: serverTimestamp(),
    estadoAnterior: cambio.estadoAnterior ?? null,
    estadoNuevo: cambio.estadoNuevo ?? null,
    etapaAnterior: cambio.etapaAnterior ?? null,
    etapaNueva: cambio.etapaNueva ?? null,
    comentario,
  };
}

const APROBAR = {
  estadoAnterior: 'enAprobacion',
  estadoNuevo: 'enGestionRh',
  etapaAnterior: 'aprobacion',
  etapaNueva: 'gestionRh',
};

const DEVOLVER = {
  estadoAnterior: 'enAprobacion',
  estadoNuevo: 'devuelta',
  etapaAnterior: 'aprobacion',
  etapaNueva: 'solicitud',
};

// -------------------------------------------------------------
// Entorno de pruebas
// -------------------------------------------------------------

let entorno;

/** Firestore visto por un usuario logueado (las reglas SÍ se aplican). */
const comoUsuario = (uid) => entorno.authenticatedContext(uid).firestore();

before(async () => {
  entorno = await initializeTestEnvironment({
    projectId: 'demo-permisos',
    firestore: { rules: await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8') },
  });
});

after(async () => {
  await entorno?.cleanup();
});

// Antes de cada test: base vacía y datos de partida cargados SIN reglas.
beforeEach(async () => {
  await entorno.clearFirestore();
  await entorno.withSecurityRulesDisabled(async (contexto) => {
    const db = contexto.firestore();
    for (const [uid, perfil] of Object.entries(PERFILES)) {
      await setDoc(doc(db, 'usuarios', uid), {
        ...perfil,
        email: `${uid}@bprosys.test`,
        area: 'Operaciones',
        fechaCreacion: Timestamp.now(),
        fechaActualizacion: Timestamp.now(),
      });
    }
    await setDoc(doc(db, 'solicitudes', 's1'), solicitudBase());
    await setDoc(
      doc(db, 'solicitudes', 'ajena'),
      solicitudBase({
        numero: 'SOL-0002',
        solicitanteId: 'otroIni',
        solicitanteNombre: 'Pedro Ruiz',
        supervisorId: 'otroSup',
        asignadoA: 'otroSup',
        asignadoNombre: 'Sofía Díaz',
        participantes: ['otroIni', 'otroSup'],
      }),
    );
    await setDoc(
      doc(db, 'solicitudes', 'deInactivo'),
      solicitudBase({ numero: 'SOL-0003', solicitanteId: 'inactivo', solicitanteNombre: 'Juan Baja', participantes: ['inactivo', 'sup'] }),
    );
    await setDoc(doc(db, 'solicitudes/s1/historial/e1'), { ...evento('ini', 'creada'), fecha: Timestamp.now() });
  });
});

// -------------------------------------------------------------
// usuarios
// -------------------------------------------------------------

describe('usuarios', () => {
  test('sin sesión no se puede leer nada', async () => {
    const anonimo = entorno.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonimo, 'usuarios/ini')));
  });

  test('un usuario lee su propio perfil', async () => {
    await assertSucceeds(getDoc(doc(comoUsuario('ini'), 'usuarios/ini')));
  });

  test('un usuario inactivo lee su perfil (para ver "dado de baja") pero no el directorio', async () => {
    await assertSucceeds(getDoc(doc(comoUsuario('inactivo'), 'usuarios/inactivo')));
    await assertFails(getDocs(collection(comoUsuario('inactivo'), 'usuarios')));
  });

  test('un iniciador no puede cambiarse el rol', async () => {
    await assertFails(
      updateDoc(doc(comoUsuario('ini'), 'usuarios/ini'), { rol: 'admin', fechaActualizacion: serverTimestamp() }),
    );
  });

  test('el admin edita un usuario, pero no puede cambiarle el email', async () => {
    const db = comoUsuario('admin');
    await assertSucceeds(
      updateDoc(doc(db, 'usuarios/ini'), { area: 'Ventas', fechaActualizacion: serverTimestamp() }),
    );
    await assertFails(
      updateDoc(doc(db, 'usuarios/ini'), { email: 'otro@bprosys.test', fechaActualizacion: serverTimestamp() }),
    );
  });

  test('nadie borra usuarios (baja lógica)', async () => {
    await assertFails(deleteDoc(doc(comoUsuario('admin'), 'usuarios/ini')));
  });
});

// -------------------------------------------------------------
// solicitudes: lectura y consultas
// -------------------------------------------------------------

describe('solicitudes: lectura', () => {
  test('el solicitante lee su solicitud, pero no la de otro equipo', async () => {
    await assertSucceeds(getDoc(doc(comoUsuario('ini'), 'solicitudes/s1')));
    await assertFails(getDoc(doc(comoUsuario('ini'), 'solicitudes/ajena')));
  });

  test('RH y admin leen cualquier solicitud', async () => {
    await assertSucceeds(getDoc(doc(comoUsuario('rh'), 'solicitudes/ajena')));
    await assertSucceeds(getDocs(collection(comoUsuario('admin'), 'solicitudes')));
  });

  test('las reglas no son filtros: el iniciador debe filtrar por participantes', async () => {
    const db = comoUsuario('ini');
    await assertSucceeds(getDocs(query(collection(db, 'solicitudes'), where('participantes', 'array-contains', 'ini'))));
    await assertFails(getDocs(collection(db, 'solicitudes')));
  });

  test('el supervisor consulta sus pendientes por asignadoA', async () => {
    const db = comoUsuario('sup');
    await assertSucceeds(getDocs(query(collection(db, 'solicitudes'), where('asignadoA', '==', 'sup'))));
  });

  test('un usuario dado de baja pierde el acceso a sus solicitudes', async () => {
    await assertFails(getDoc(doc(comoUsuario('inactivo'), 'solicitudes/deInactivo')));
  });
});

// -------------------------------------------------------------
// solicitudes: creación
// -------------------------------------------------------------

describe('solicitudes: creación', () => {
  /** Crea una solicitud y su evento "creada" en un mismo lote. */
  async function crear(uid, cambios = {}) {
    const db = comoUsuario(uid);
    const referencia = doc(collection(db, 'solicitudes'));
    const lote = writeBatch(db);
    lote.set(
      referencia,
      solicitudBase({
        fechaCreacion: serverTimestamp(),
        fechaActualizacion: serverTimestamp(),
        ...cambios,
      }),
    );
    lote.set(
      doc(collection(db, `solicitudes/${referencia.id}/historial`)),
      evento(uid, 'creada', { estadoNuevo: 'enAprobacion', etapaNueva: 'aprobacion' }),
    );
    return lote.commit();
  }

  test('un iniciador crea una solicitud válida con su evento de historial', async () => {
    await assertSucceeds(crear('ini'));
  });

  test('no se puede asignar a otro que no sea su supervisor', async () => {
    await assertFails(crear('ini', { asignadoA: 'rh', participantes: ['ini', 'rh'] }));
  });

  test('un supervisor no puede crear solicitudes', async () => {
    await assertFails(crear('sup', { solicitanteId: 'sup', solicitanteNombre: 'Carlos Pérez' }));
  });

  test('no se pueden pedir más días que el máximo del tipo (vacaciones: 15)', async () => {
    await assertFails(crear('ini', { fechaFin: '2026-11-22', cantidadDias: 20 }));
  });

  test('no se puede crear directamente en otro estado', async () => {
    await assertFails(crear('ini', { estadoActual: 'enGestionRh', etapaActual: 'gestionRh' }));
  });
});

// -------------------------------------------------------------
// solicitudes: transiciones
// -------------------------------------------------------------

describe('solicitudes: transiciones', () => {
  /** Actualiza s1 y agrega el evento del historial en un mismo lote. */
  function transicion(uid, datos, eventoNuevo) {
    const db = comoUsuario(uid);
    const lote = writeBatch(db);
    lote.update(doc(db, 'solicitudes/s1'), { ...datos, fechaActualizacion: serverTimestamp() });
    lote.set(doc(collection(db, 'solicitudes/s1/historial')), eventoNuevo);
    return lote.commit();
  }

  const datosAprobada = {
    estadoActual: 'enGestionRh',
    etapaActual: 'gestionRh',
    asignadoA: 'rh',
    asignadoNombre: 'Laura Fernández',
    rolAsignado: 'rh',
    vistaPorAsignado: false,
    participantes: ['ini', 'sup', 'rh'],
  };

  test('el supervisor asignado aprueba y queda asignada a RH', async () => {
    await assertSucceeds(transicion('sup', datosAprobada, evento('sup', 'aprobada', APROBAR)));
  });

  test('el iniciador no puede aprobar su propia solicitud', async () => {
    await assertFails(
      transicion('ini', { ...datosAprobada, participantes: ['ini', 'sup', 'rh'] }, evento('ini', 'aprobada', APROBAR)),
    );
  });

  test('al aprobar no se puede asignar a alguien que no es RH', async () => {
    await assertFails(
      transicion(
        'sup',
        { ...datosAprobada, asignadoA: 'admin', asignadoNombre: 'Martín Sosa', participantes: ['ini', 'sup', 'admin'] },
        evento('sup', 'aprobada', APROBAR),
      ),
    );
  });

  test('no se puede saltar de "enAprobacion" a "completada"', async () => {
    await assertFails(
      transicion(
        'sup',
        { estadoActual: 'completada', etapaActual: 'finalizada', asignadoA: null, asignadoNombre: null, rolAsignado: null, vistaPorAsignado: true },
        evento('sup', 'completada', { ...APROBAR, estadoNuevo: 'completada', etapaNueva: 'finalizada' }),
      ),
    );
  });

  test('devolver exige un comentario en el historial', async () => {
    const datosDevuelta = {
      estadoActual: 'devuelta',
      etapaActual: 'solicitud',
      asignadoA: 'ini',
      asignadoNombre: 'Ana Gómez',
      rolAsignado: 'iniciador',
      vistaPorAsignado: false,
    };
    await assertFails(transicion('sup', datosDevuelta, evento('sup', 'devuelta', DEVOLVER, '')));
    await assertSucceeds(transicion('sup', datosDevuelta, evento('sup', 'devuelta', DEVOLVER, 'Falta firma')));
  });

  test('el evento no puede mentir sobre el estado nuevo', async () => {
    await assertFails(
      transicion('sup', datosAprobada, evento('sup', 'aprobada', { ...APROBAR, estadoNuevo: 'completada' })),
    );
  });

  test('solo el asignado marca la solicitud como vista', async () => {
    const marcarVista = (uid) =>
      updateDoc(doc(comoUsuario(uid), 'solicitudes/s1'), {
        vistaPorAsignado: true,
        fechaActualizacion: serverTimestamp(),
      });
    await assertFails(marcarVista('ini'));
    await assertSucceeds(marcarVista('sup'));
  });

  test('las solicitudes no se borran', async () => {
    await assertFails(deleteDoc(doc(comoUsuario('admin'), 'solicitudes/s1')));
  });
});

// -------------------------------------------------------------
// historial (trazabilidad)
// -------------------------------------------------------------

describe('historial', () => {
  test('un participante agrega una nota firmada por él', async () => {
    const db = comoUsuario('ini');
    const lote = writeBatch(db);
    lote.update(doc(db, 'solicitudes/s1'), { cantidadNotas: 1, fechaActualizacion: serverTimestamp() });
    lote.set(doc(collection(db, 'solicitudes/s1/historial')), evento('ini', 'notaAgregada', {}, 'Compenso el viernes'));
    await assertSucceeds(lote.commit());
  });

  test('no se puede firmar un evento a nombre de otro usuario', async () => {
    const falso = { ...evento('ini', 'notaAgregada', {}, 'Hola'), usuarioId: 'sup', usuarioNombre: 'Carlos Pérez' };
    await assertFails(setDoc(doc(comoUsuario('ini'), 'solicitudes/s1/historial/x'), falso));
  });

  test('el historial no se edita ni se borra (append-only)', async () => {
    const db = comoUsuario('admin');
    await assertFails(updateDoc(doc(db, 'solicitudes/s1/historial/e1'), { comentario: 'cambiado' }));
    await assertFails(deleteDoc(doc(db, 'solicitudes/s1/historial/e1')));
  });
});

// -------------------------------------------------------------
// adjuntos
// -------------------------------------------------------------

describe('adjuntos', () => {
  /** Sube un adjunto a s1 (con contador y evento) en un mismo lote. */
  function subir(tamanoBytes, tipoMime = 'application/pdf') {
    const db = comoUsuario('ini');
    const lote = writeBatch(db);
    lote.update(doc(db, 'solicitudes/s1'), { cantidadAdjuntos: 1, fechaActualizacion: serverTimestamp() });
    lote.set(doc(collection(db, 'solicitudes/s1/adjuntos')), {
      nombreArchivo: 'certificado.pdf',
      tipoMime,
      tamanoBytes,
      contenidoBase64: 'A'.repeat(Math.ceil(tamanoBytes / 3) * 4),
      subidoPor: 'ini',
      subidoPorNombre: 'Ana Gómez',
      fechaSubida: serverTimestamp(),
    });
    lote.set(doc(collection(db, 'solicitudes/s1/historial')), evento('ini', 'adjuntoAgregado', {}, 'certificado.pdf'));
    return lote.commit();
  }

  test('se acepta un PDF de 600 KB (el máximo)', async () => {
    await assertSucceeds(subir(600 * 1024));
  });

  test('se rechaza un archivo de 700 KB', async () => {
    await assertFails(subir(700 * 1024));
  });

  test('se rechaza un tipo de archivo no permitido', async () => {
    await assertFails(subir(1000, 'application/x-msdownload'));
  });
});
