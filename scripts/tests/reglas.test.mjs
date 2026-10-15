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
 * Depende de: @firebase/rules-unit-testing, firebase (SDK cliente), firestore.rules,
 *   src/config/constantes.js (permisos y descripciones de fábrica de los roles)
 * =============================================================
 */

import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
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
  getCountFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  serverTimestamp,
  Timestamp,
  setLogLevel,
} from 'firebase/firestore';
// Las reglas tienen una copia de estos valores: si difieren, los tests de roles fallan.
import { DESCRIPCIONES_ROL, NOMBRES_ROL, PERMISOS_POR_ROL } from '../../src/config/constantes.js';

// Los rechazos esperados (assertFails) hacen que el SDK imprima PERMISSION_DENIED
// en consola. Se silencian: el resultado de cada test ya informa si algo falla.
setLogLevel('silent');

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

/** Último número usado por el contador al empezar cada test. */
const ULTIMO_NUMERO = 10;

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
    ultimoEventoId: 'e1',
    referenciaRh: null,
    diasDescontados: null,
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

const REENVIAR = {
  estadoAnterior: 'devuelta',
  estadoNuevo: 'enAprobacion',
  etapaAnterior: 'solicitud',
  etapaNueva: 'aprobacion',
};

/** Datos de un adjunto válido de "tamanoBytes" bytes, subido por "ini". */
function adjunto(tamanoBytes, tipoMime = 'application/pdf') {
  return {
    nombreArchivo: 'certificado.pdf',
    tipoMime,
    tamanoBytes,
    contenidoBase64: 'A'.repeat(Math.ceil(tamanoBytes / 3) * 4),
    subidoPor: 'ini',
    subidoPorNombre: 'Ana Gómez',
    fechaSubida: serverTimestamp(),
  };
}

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
    await setDoc(doc(db, 'contadores', 'solicitudes'), { ultimoNumero: ULTIMO_NUMERO });

    // Catálogo de roles SIN "admin", para probar la creación de un rol faltante.
    for (const clave of ['iniciador', 'supervisor', 'rh']) {
      await setDoc(doc(db, 'roles', clave), {
        nombre: NOMBRES_ROL[clave],
        descripcion: DESCRIPCIONES_ROL[clave],
        permisos: [...PERMISOS_POR_ROL[clave]],
      });
    }

    await setDoc(doc(db, 'solicitudes', 's1'), solicitudBase());
    await setDoc(doc(db, 'solicitudes/s1/historial/e0'), { ...evento('ini', 'notaAgregada', {}, 'vieja'), fecha: Timestamp.now() });
    await setDoc(doc(db, 'solicitudes/s1/historial/e1'), { ...evento('ini', 'creada'), fecha: Timestamp.now() });

    await setDoc(
      doc(db, 'solicitudes', 'devuelta1'),
      solicitudBase({
        numero: 'SOL-0004',
        estadoActual: 'devuelta',
        etapaActual: 'solicitud',
        asignadoA: 'ini',
        asignadoNombre: 'Ana Gómez',
        rolAsignado: 'iniciador',
      }),
    );
    await setDoc(
      doc(db, 'solicitudes', 'enRh1'),
      solicitudBase({
        numero: 'SOL-0005',
        estadoActual: 'enGestionRh',
        etapaActual: 'gestionRh',
        asignadoA: 'rh',
        asignadoNombre: 'Laura Fernández',
        rolAsignado: 'rh',
        participantes: ['ini', 'sup', 'rh'],
      }),
    );
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
// usuarios: mantenimiento (alta, edición, baja y reactivación)
// -------------------------------------------------------------

/** Perfil completo de un usuario nuevo, como lo escribe el alta de la app. */
function perfilNuevo(cambios = {}) {
  return {
    nombre: 'Lucía Torres',
    email: 'lucia.torres@bprosys.test',
    rol: 'iniciador',
    supervisorId: 'sup',
    area: 'Ventas',
    activo: true,
    fechaCreacion: serverTimestamp(),
    fechaActualizacion: serverTimestamp(),
    ...cambios,
  };
}

/** El usuario "como" edita el perfil "uid". */
const editarUsuario = (uid, cambios, como = 'admin') =>
  updateDoc(doc(comoUsuario(como), 'usuarios', uid), { ...cambios, fechaActualizacion: serverTimestamp() });

/** Cambia perfiles sin pasar por las reglas (para preparar un escenario). */
async function prepararPerfiles(cambiosPorUid) {
  await entorno.withSecurityRulesDisabled(async (contexto) => {
    for (const [uid, cambios] of Object.entries(cambiosPorUid)) {
      await updateDoc(doc(contexto.firestore(), 'usuarios', uid), cambios);
    }
  });
}

describe('usuarios: mantenimiento', () => {
  test('el admin da de alta un iniciador con un supervisor activo', async () => {
    await assertSucceeds(setDoc(doc(comoUsuario('admin'), 'usuarios/nuevo'), perfilNuevo()));
  });

  test('solo el admin da de alta usuarios; una cuenta nueva no se crea su propio perfil', async () => {
    await assertFails(setDoc(doc(comoUsuario('rh'), 'usuarios/nuevo'), perfilNuevo()));
    await assertFails(setDoc(doc(comoUsuario('nuevo'), 'usuarios/nuevo'), perfilNuevo()));
  });

  test('un usuario nuevo no se crea dado de baja', async () => {
    await assertFails(setDoc(doc(comoUsuario('admin'), 'usuarios/nuevo'), perfilNuevo({ activo: false })));
  });

  test('el iniciador necesita un supervisor existente, con rol supervisor y activo', async () => {
    const db = comoUsuario('admin');
    await assertFails(setDoc(doc(db, 'usuarios/nuevo'), perfilNuevo({ supervisorId: null })));
    await assertFails(setDoc(doc(db, 'usuarios/nuevo'), perfilNuevo({ supervisorId: 'noExiste' })));
    await assertFails(setDoc(doc(db, 'usuarios/nuevo'), perfilNuevo({ supervisorId: 'rh' })));
    await prepararPerfiles({ otroSup: { activo: false } });
    await assertFails(setDoc(doc(db, 'usuarios/nuevo'), perfilNuevo({ supervisorId: 'otroSup' })));
  });

  test('los demás roles no llevan supervisor', async () => {
    const db = comoUsuario('admin');
    await assertFails(setDoc(doc(db, 'usuarios/nuevo'), perfilNuevo({ rol: 'supervisor', supervisorId: 'sup' })));
    await assertSucceeds(setDoc(doc(db, 'usuarios/nuevo'), perfilNuevo({ rol: 'supervisor', supervisorId: null })));
  });

  test('un iniciador no puede ser su propio supervisor', async () => {
    await assertFails(editarUsuario('sup', { rol: 'iniciador', supervisorId: 'sup' }));
  });

  test('el área es obligatoria', async () => {
    await assertFails(editarUsuario('ini', { area: '' }));
  });

  test('el admin da de baja y reactiva a otro usuario', async () => {
    await assertSucceeds(editarUsuario('otroIni', { activo: false }));
    await assertSucceeds(editarUsuario('otroIni', { activo: true }));
  });

  test('el admin no puede darse de baja ni cambiarse el rol, pero sí editar su nombre', async () => {
    await assertFails(editarUsuario('admin', { activo: false }));
    await assertFails(editarUsuario('admin', { rol: 'rh' }));
    await assertSucceeds(editarUsuario('admin', { nombre: 'Martín S. Sosa' }));
  });

  test('no se reactiva un iniciador cuyo supervisor está dado de baja, salvo que se le asigne otro', async () => {
    await prepararPerfiles({ otroSup: { activo: false }, otroIni: { activo: false } });
    await assertFails(editarUsuario('otroIni', { activo: true }));
    // Mientras está dado de baja se lo puede editar aunque su supervisor también lo esté.
    await assertSucceeds(editarUsuario('otroIni', { area: 'Comercial' }));
    await assertSucceeds(editarUsuario('otroIni', { activo: true, supervisorId: 'sup' }));
  });
});

// -------------------------------------------------------------
// roles
// -------------------------------------------------------------

describe('roles', () => {
  test('cualquier usuario activo lee el catálogo; uno dado de baja, no', async () => {
    await assertSucceeds(getDocs(collection(comoUsuario('ini'), 'roles')));
    await assertFails(getDocs(collection(comoUsuario('inactivo'), 'roles')));
  });

  test('el admin edita el nombre y la descripción de un rol', async () => {
    await assertSucceeds(
      updateDoc(doc(comoUsuario('admin'), 'roles/rh'), { nombre: 'RRHH', descripcion: 'Liquida los permisos aprobados' }),
    );
  });

  test('los permisos de un rol no se editan', async () => {
    await assertFails(
      updateDoc(doc(comoUsuario('admin'), 'roles/iniciador'), { permisos: ['solicitud.crear', 'solicitud.aprobar'] }),
    );
  });

  test('solo el admin edita roles', async () => {
    await assertFails(updateDoc(doc(comoUsuario('rh'), 'roles/rh'), { nombre: 'Jefes de RH' }));
  });

  test('el admin recrea un rol del sistema que falta, solo con sus permisos de fábrica', async () => {
    const db = comoUsuario('admin');
    const rol = { nombre: NOMBRES_ROL.admin, descripcion: DESCRIPCIONES_ROL.admin };
    await assertFails(setDoc(doc(db, 'roles/admin'), { ...rol, permisos: [...PERMISOS_POR_ROL.admin, 'solicitud.aprobar'] }));
    await assertSucceeds(setDoc(doc(db, 'roles/admin'), { ...rol, permisos: [...PERMISOS_POR_ROL.admin] }));
  });

  test('no se crean roles fuera de los 4 del sistema', async () => {
    await assertFails(setDoc(doc(comoUsuario('admin'), 'roles/auditor'), { nombre: 'Auditor', descripcion: '', permisos: [] }));
  });

  test('los roles no se borran', async () => {
    await assertFails(deleteDoc(doc(comoUsuario('admin'), 'roles/rh')));
  });
});

// -------------------------------------------------------------
// contadores
// -------------------------------------------------------------

describe('contadores', () => {
  test('el contador no puede saltar números', async () => {
    await assertFails(
      updateDoc(doc(comoUsuario('ini'), 'contadores/solicitudes'), { ultimoNumero: ULTIMO_NUMERO + 2 }),
    );
  });

  test('un supervisor no puede tocar el contador', async () => {
    await assertFails(
      updateDoc(doc(comoUsuario('sup'), 'contadores/solicitudes'), { ultimoNumero: ULTIMO_NUMERO + 1 }),
    );
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

  test('pestaña "Todas": RH y admin consultan todo ordenado y con tope; el supervisor no', async () => {
    const todas = (uid) =>
      getDocs(query(collection(comoUsuario(uid), 'solicitudes'), orderBy('fechaActualizacion', 'desc'), limit(200)));
    await assertSucceeds(todas('rh'));
    await assertSucceeds(todas('admin'));
    await assertFails(todas('sup'));
  });

  test('pestañas "Pendientes" y "Enviadas": consultas ordenadas con tope', async () => {
    const db = comoUsuario('sup');
    const orden = [orderBy('fechaActualizacion', 'desc'), limit(200)];
    await assertSucceeds(getDocs(query(collection(db, 'solicitudes'), where('asignadoA', '==', 'sup'), ...orden)));
    await assertSucceeds(getDocs(query(collection(db, 'solicitudes'), where('participantes', 'array-contains', 'sup'), ...orden)));
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

// -------------------------------------------------------------
// reportes (consultas de toda la empresa)
// -------------------------------------------------------------

/** Cuenta las solicitudes en un estado, como el reporte de distribución. */
const contarEnEstado = (uid, estado) =>
  getCountFromServer(query(collection(comoUsuario(uid), 'solicitudes'), where('estadoActual', '==', estado)));

/** Lista los trámites abiertos, como el reporte de carga por usuario. */
const listarAbiertas = (uid) =>
  getDocs(query(collection(comoUsuario(uid), 'solicitudes'), where('estadoActual', 'in', ['enAprobacion', 'devuelta', 'enGestionRh'])));

describe('reportes', () => {
  test('RH y admin cuentan las solicitudes por estado en el servidor', async () => {
    const resultado = await assertSucceeds(contarEnEstado('rh', 'enAprobacion'));
    assert.equal(resultado.data().count, 3); // s1, ajena y deInactivo
    await assertSucceeds(contarEnEstado('admin', 'devuelta'));
  });

  test('un supervisor o un iniciador no pueden contar todas las solicitudes', async () => {
    await assertFails(contarEnEstado('sup', 'enAprobacion'));
    await assertFails(contarEnEstado('ini', 'enAprobacion'));
  });

  test('RH y admin listan los trámites abiertos; un supervisor no', async () => {
    const resultado = await assertSucceeds(listarAbiertas('admin'));
    assert.equal(resultado.size, 5);
    await assertSucceeds(listarAbiertas('rh'));
    await assertFails(listarAbiertas('sup'));
  });

  test('un RH dado de baja pierde el acceso a los reportes', async () => {
    await prepararPerfiles({ rh: { activo: false } });
    await assertFails(contarEnEstado('rh', 'enAprobacion'));
  });
});

describe('solicitudes: creación', () => {
  /**
   * Crea una solicitud como lo hará la app: incrementa el contador, crea la
   * solicitud, su evento "creada" y (opcional) adjuntos, todo en un mismo lote.
   */
  async function crear(uid, cambios = {}, opciones = {}) {
    const { incrementarContador = true, adjuntos = [] } = opciones;
    const db = comoUsuario(uid);
    const referencia = doc(collection(db, 'solicitudes'));
    const referenciaEvento = doc(collection(db, `solicitudes/${referencia.id}/historial`));
    const lote = writeBatch(db);
    if (incrementarContador) {
      lote.update(doc(db, 'contadores/solicitudes'), { ultimoNumero: ULTIMO_NUMERO + 1 });
    }
    lote.set(
      referencia,
      solicitudBase({
        numero: 'SOL-0011',
        cantidadAdjuntos: adjuntos.length,
        ultimoEventoId: referenciaEvento.id,
        fechaCreacion: serverTimestamp(),
        fechaActualizacion: serverTimestamp(),
        ...cambios,
      }),
    );
    lote.set(referenciaEvento, evento(uid, 'creada', { estadoNuevo: 'enAprobacion', etapaNueva: 'aprobacion' }));
    for (const datosAdjunto of adjuntos) {
      lote.set(doc(collection(db, `solicitudes/${referencia.id}/adjuntos`)), datosAdjunto);
      lote.set(
        doc(collection(db, `solicitudes/${referencia.id}/historial`)),
        evento(uid, 'adjuntoAgregado', {}, datosAdjunto.nombreArchivo),
      );
    }
    return lote.commit();
  }

  test('un iniciador crea una solicitud válida con su evento de historial', async () => {
    await assertSucceeds(crear('ini'));
  });

  test('no se puede crear sin incrementar el contador', async () => {
    await assertFails(crear('ini', {}, { incrementarContador: false }));
  });

  test('el número tiene que ser el siguiente del contador', async () => {
    await assertFails(crear('ini', { numero: 'SOL-0099' }));
  });

  test('ultimoEventoId tiene que apuntar al evento creado en el lote', async () => {
    await assertFails(crear('ini', { ultimoEventoId: 'inventado' }));
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

  test('no se puede crear con campos de gestión RH ya cargados', async () => {
    await assertFails(crear('ini', { referenciaRh: 'LIQ-1', diasDescontados: 5 }));
  });

  test('no se puede crear directamente en otro estado', async () => {
    await assertFails(crear('ini', { estadoActual: 'enGestionRh', etapaActual: 'gestionRh' }));
  });

  test('se puede crear con 3 adjuntos (el máximo al crear) en un mismo lote', async () => {
    // Cada documento del lote evalúa reglas con get()/exists(): este caso verifica
    // que el lote más grande que arma la app no supera los límites de Firestore.
    const tres = [adjunto(600 * 1024), adjunto(600 * 1024), adjunto(600 * 1024)];
    await assertSucceeds(crear('ini', { tipoPermiso: 'enfermedad', fechaFin: '2026-11-05', cantidadDias: 3 }, { adjuntos: tres }));
  });

  test('enfermedad exige adjunto: sin archivo se rechaza, con archivo se acepta', async () => {
    const enfermedad = { tipoPermiso: 'enfermedad', fechaFin: '2026-11-05', cantidadDias: 3 };
    await assertFails(crear('ini', enfermedad));
    await assertSucceeds(crear('ini', enfermedad, { adjuntos: [adjunto(50_000)] }));
  });
});

// -------------------------------------------------------------
// solicitudes: transiciones
// -------------------------------------------------------------

describe('solicitudes: transiciones', () => {
  /** Actualiza una solicitud y agrega el evento del historial en un mismo lote. */
  function transicion(uid, datos, eventoNuevo, id = 's1') {
    const db = comoUsuario(uid);
    const referenciaEvento = doc(collection(db, `solicitudes/${id}/historial`));
    const lote = writeBatch(db);
    lote.update(doc(db, `solicitudes/${id}`), {
      ultimoEventoId: referenciaEvento.id,
      ...datos,
      fechaActualizacion: serverTimestamp(),
    });
    lote.set(referenciaEvento, eventoNuevo);
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

  const datosReenviada = {
    estadoActual: 'enAprobacion',
    etapaActual: 'aprobacion',
    asignadoA: 'sup',
    asignadoNombre: 'Carlos Pérez',
    rolAsignado: 'supervisor',
    vistaPorAsignado: false,
  };

  test('el supervisor asignado aprueba y queda asignada a RH', async () => {
    await assertSucceeds(transicion('sup', datosAprobada, evento('sup', 'aprobada', APROBAR)));
  });

  test('el iniciador no puede aprobar su propia solicitud', async () => {
    await assertFails(transicion('ini', datosAprobada, evento('ini', 'aprobada', APROBAR)));
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

  test('el solicitante corrige los datos al reenviar una solicitud devuelta', async () => {
    await assertSucceeds(
      transicion('ini', { ...datosReenviada, motivo: 'Viaje familiar (fechas corregidas)' }, evento('ini', 'reenviada', REENVIAR), 'devuelta1'),
    );
  });

  test('los datos no se pueden editar fuera de un reenvío', async () => {
    // Edita el motivo de una solicitud en aprobación, "justificándolo" con una nota.
    await assertFails(
      transicion('ini', { motivo: 'Otro motivo', cantidadNotas: 1 }, evento('ini', 'notaAgregada', {}, 'cambio')),
    );
  });

  test('solo el asignado marca la solicitud como vista (sin evento)', async () => {
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
// gestión RH: control de campos por rol (MATRIZ_CAMPOS)
// -------------------------------------------------------------

describe('gestión RH (campos por rol)', () => {
  const COMPLETAR = {
    estadoAnterior: 'enGestionRh',
    estadoNuevo: 'completada',
    etapaAnterior: 'gestionRh',
    etapaNueva: 'finalizada',
  };
  const finalizada = (estado) => ({
    estadoActual: estado,
    etapaActual: 'finalizada',
    asignadoA: null,
    asignadoNombre: null,
    rolAsignado: null,
    vistaPorAsignado: true,
  });

  /** Ejecuta una acción sobre "enRh1" con su evento, como la app. */
  function actuar(uid, datos, eventoNuevo, id = 'enRh1') {
    const db = comoUsuario(uid);
    const referenciaEvento = doc(collection(db, `solicitudes/${id}/historial`));
    const lote = writeBatch(db);
    lote.update(doc(db, `solicitudes/${id}`), { ...datos, ultimoEventoId: referenciaEvento.id, fechaActualizacion: serverTimestamp() });
    lote.set(referenciaEvento, eventoNuevo);
    return lote.commit();
  }

  test('RH completa cargando referencia y días descontados', async () => {
    await assertSucceeds(
      actuar('rh', { ...finalizada('completada'), referenciaRh: 'LIQ-2026-0042', diasDescontados: 5 }, evento('rh', 'completada', COMPLETAR)),
    );
  });

  test('no se puede completar sin la referencia de liquidación', async () => {
    await assertFails(actuar('rh', { ...finalizada('completada'), diasDescontados: 5 }, evento('rh', 'completada', COMPLETAR)));
  });

  test('los días descontados no pueden superar los del permiso', async () => {
    await assertFails(
      actuar('rh', { ...finalizada('completada'), referenciaRh: 'LIQ-1', diasDescontados: 6 }, evento('rh', 'completada', COMPLETAR)),
    );
  });

  test('al rechazar en RH no se cargan los campos de gestión', async () => {
    await assertFails(
      actuar(
        'rh',
        { ...finalizada('rechazada'), referenciaRh: 'LIQ-1', diasDescontados: 0 },
        evento('rh', 'rechazada', { ...COMPLETAR, estadoNuevo: 'rechazada' }, 'Sin saldo'),
      ),
    );
  });

  test('el supervisor no puede cargar campos de RH al aprobar', async () => {
    await assertFails(
      actuar(
        'sup',
        {
          estadoActual: 'enGestionRh',
          etapaActual: 'gestionRh',
          asignadoA: 'rh',
          asignadoNombre: 'Laura Fernández',
          rolAsignado: 'rh',
          vistaPorAsignado: false,
          participantes: ['ini', 'sup', 'rh'],
          referenciaRh: 'LIQ-trucha',
        },
        evento('sup', 'aprobada', APROBAR),
        's1',
      ),
    );
  });
});

// -------------------------------------------------------------
// trazabilidad: ningún cambio sin su evento
// -------------------------------------------------------------

describe('trazabilidad', () => {
  const datosAprobada = {
    estadoActual: 'enGestionRh',
    etapaActual: 'gestionRh',
    asignadoA: 'rh',
    asignadoNombre: 'Laura Fernández',
    rolAsignado: 'rh',
    vistaPorAsignado: false,
    participantes: ['ini', 'sup', 'rh'],
    fechaActualizacion: serverTimestamp(),
  };

  test('no se puede cambiar el estado sin escribir el evento', async () => {
    await assertFails(updateDoc(doc(comoUsuario('sup'), 'solicitudes/s1'), datosAprobada));
  });

  test('no se puede apuntar a un evento que ya existía', async () => {
    await assertFails(updateDoc(doc(comoUsuario('sup'), 'solicitudes/s1'), { ...datosAprobada, ultimoEventoId: 'e0' }));
  });

  test('no se puede disfrazar un cambio de estado como una nota', async () => {
    const db = comoUsuario('sup');
    const referenciaEvento = doc(collection(db, 'solicitudes/s1/historial'));
    const lote = writeBatch(db);
    lote.update(doc(db, 'solicitudes/s1'), { ...datosAprobada, cantidadNotas: 1, ultimoEventoId: referenciaEvento.id });
    lote.set(referenciaEvento, evento('sup', 'notaAgregada', {}, 'todo ok'));
    await assertFails(lote.commit());
  });
});

// -------------------------------------------------------------
// historial (notas)
// -------------------------------------------------------------

describe('historial', () => {
  /** Agrega una nota a s1 como lo hará la app (contador + evento + ultimoEventoId). */
  function agregarNota(uid, eventoNota) {
    const db = comoUsuario(uid);
    const referenciaEvento = doc(collection(db, 'solicitudes/s1/historial'));
    const lote = writeBatch(db);
    lote.update(doc(db, 'solicitudes/s1'), {
      cantidadNotas: 1,
      ultimoEventoId: referenciaEvento.id,
      fechaActualizacion: serverTimestamp(),
    });
    lote.set(referenciaEvento, eventoNota);
    return lote.commit();
  }

  test('un participante agrega una nota firmada por él', async () => {
    await assertSucceeds(agregarNota('ini', evento('ini', 'notaAgregada', {}, 'Compenso el viernes')));
  });

  test('no se puede firmar un evento a nombre de otro usuario', async () => {
    const falso = { ...evento('ini', 'notaAgregada', {}, 'Hola'), usuarioId: 'sup', usuarioNombre: 'Carlos Pérez' };
    await assertFails(agregarNota('ini', falso));
  });

  test('una nota suelta (sin actualizar la solicitud) se rechaza', async () => {
    await assertFails(
      setDoc(doc(comoUsuario('ini'), 'solicitudes/s1/historial/suelto'), evento('ini', 'notaAgregada', {}, 'Hola')),
    );
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
  /** Sube un adjunto a s1 (contador + adjunto + evento) en un mismo lote. */
  function subir(datosAdjunto, { sumarContador = true } = {}) {
    const db = comoUsuario('ini');
    const referenciaEvento = doc(collection(db, 'solicitudes/s1/historial'));
    const lote = writeBatch(db);
    lote.update(doc(db, 'solicitudes/s1'), {
      cantidadAdjuntos: sumarContador ? 1 : 0,
      ultimoEventoId: referenciaEvento.id,
      fechaActualizacion: serverTimestamp(),
    });
    lote.set(doc(collection(db, 'solicitudes/s1/adjuntos')), datosAdjunto);
    lote.set(referenciaEvento, evento('ini', 'adjuntoAgregado', {}, datosAdjunto.nombreArchivo));
    return lote.commit();
  }

  test('se acepta un PDF de 600 KB (el máximo)', async () => {
    await assertSucceeds(subir(adjunto(600 * 1024)));
  });

  test('se rechaza un archivo de 700 KB', async () => {
    await assertFails(subir(adjunto(700 * 1024)));
  });

  test('se rechaza un tipo de archivo no permitido', async () => {
    await assertFails(subir(adjunto(1000, 'application/x-msdownload')));
  });

  test('un adjunto sin sumar el contador de la solicitud se rechaza', async () => {
    await assertFails(subir(adjunto(1000), { sumarContador: false }));
  });
});
