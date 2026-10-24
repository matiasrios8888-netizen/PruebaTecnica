/**
 * =============================================================
 * Tests UNITARIOS: lógica pura del flujo
 * Archivo: scripts/tests/flujoSolicitud.test.mjs
 *
 * Responsabilidad:
 *   Probar src/services/flujoSolicitud.js sin Firebase ni navegador:
 *   acciones disponibles por rol y estado, transiciones, asignación,
 *   reparto rotativo de RH y validaciones de datos, notas y adjuntos.
 *
 * Uso (desde scripts/):  npm run test:flujo
 *
 * Depende de: src/services/flujoSolicitud.js, src/services/errores.js
 * =============================================================
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  formatearNumeroSolicitud,
  calcularCantidadDias,
  validarDatosSolicitud,
  validarArchivoAdjunto,
  accionesDisponibles,
  puedeAgregarSeguimiento,
  puedeCorregirDatos,
  elegirUsuarioRh,
  calcularTransicion,
  construirEventoNota,
  accesoACampos,
  validarGestionRh,
  ordenarHistorial,
} from '../../src/services/flujoSolicitud.js';
import { ErrorAplicacion } from '../../src/services/errores.js';

// -------------------------------------------------------------
// Datos de prueba
// -------------------------------------------------------------

const ana = { id: 'ana', nombre: 'Ana Gómez', rol: 'iniciador', supervisorId: 'carlos', activo: true };
const carlos = { id: 'carlos', nombre: 'Carlos Pérez', rol: 'supervisor', supervisorId: null, activo: true };
const laura = { id: 'laura', nombre: 'Laura Fernández', rol: 'rh', supervisorId: null, activo: true };
const bruno = { id: 'bruno', nombre: 'Bruno Alvarez', rol: 'rh', supervisorId: null, activo: true };
const martin = { id: 'martin', nombre: 'Martín Sosa', rol: 'admin', supervisorId: null, activo: true };

/** Solicitud en aprobación de Ana, asignada a Carlos. */
function solicitud(cambios = {}) {
  return {
    numero: 'SOL-0011',
    tipoPermiso: 'vacaciones',
    solicitanteId: 'ana',
    solicitanteNombre: 'Ana Gómez',
    supervisorId: 'carlos',
    estadoActual: 'enAprobacion',
    etapaActual: 'aprobacion',
    asignadoA: 'carlos',
    participantes: ['ana', 'carlos'],
    ...cambios,
  };
}

/** Verifica que la función lance un ErrorAplicacion con ese código. */
function lanzaError(funcion, codigo) {
  assert.throws(funcion, (error) => error instanceof ErrorAplicacion && error.codigo === codigo);
}

// -------------------------------------------------------------
// Numeración y fechas
// -------------------------------------------------------------

describe('numeración y fechas', () => {
  test('formatea el número con 4 dígitos', () => {
    assert.equal(formatearNumeroSolicitud(11), 'SOL-0011');
    assert.equal(formatearNumeroSolicitud(1234), 'SOL-1234');
  });

  test('cuenta los días corridos incluyendo el primero y el último', () => {
    assert.equal(calcularCantidadDias('2026-11-03', '2026-11-07'), 5);
    assert.equal(calcularCantidadDias('2026-11-03', '2026-11-03'), 1);
    assert.equal(calcularCantidadDias('2026-12-30', '2027-01-02'), 4); // cambio de año
  });

  test('rechaza fechas que no existen', () => {
    lanzaError(() => calcularCantidadDias('2026-02-30', '2026-03-02'), 'fechaInvalida');
  });
});

// -------------------------------------------------------------
// Validación de datos
// -------------------------------------------------------------

describe('validarDatosSolicitud', () => {
  const datos = { tipoPermiso: 'vacaciones', fechaInicio: '2026-11-03', fechaFin: '2026-11-07', motivo: '  Viaje  ' };

  test('acepta datos válidos, calcula los días y limpia el motivo', () => {
    const resultado = validarDatosSolicitud(datos, { cantidadAdjuntos: 0 });
    assert.equal(resultado.cantidadDias, 5);
    assert.equal(resultado.motivo, 'Viaje');
  });

  test('rechaza la fecha de fin anterior a la de inicio', () => {
    lanzaError(() => validarDatosSolicitud({ ...datos, fechaFin: '2026-11-01' }, { cantidadAdjuntos: 0 }), 'fechasInvertidas');
  });

  test('rechaza más días que el máximo del tipo', () => {
    lanzaError(() => validarDatosSolicitud({ ...datos, fechaFin: '2026-11-30' }, { cantidadAdjuntos: 0 }), 'superaDiasMaximos');
  });

  test('exige motivo', () => {
    lanzaError(() => validarDatosSolicitud({ ...datos, motivo: '   ' }, { cantidadAdjuntos: 0 }), 'motivoVacio');
  });

  test('enfermedad exige al menos un adjunto', () => {
    const enfermedad = { ...datos, tipoPermiso: 'enfermedad' };
    lanzaError(() => validarDatosSolicitud(enfermedad, { cantidadAdjuntos: 0 }), 'faltaAdjunto');
    assert.equal(validarDatosSolicitud(enfermedad, { cantidadAdjuntos: 1 }).cantidadDias, 5);
  });
});

describe('validarArchivoAdjunto', () => {
  test('acepta un PDF de 600 KB y rechaza uno de 601 KB', () => {
    validarArchivoAdjunto({ nombre: 'a.pdf', tipo: 'application/pdf', tamano: 600 * 1024 });
    lanzaError(
      () => validarArchivoAdjunto({ nombre: 'a.pdf', tipo: 'application/pdf', tamano: 601 * 1024 }),
      'archivoGrande',
    );
  });

  test('rechaza tipos no permitidos', () => {
    lanzaError(() => validarArchivoAdjunto({ nombre: 'a.exe', tipo: 'application/x-msdownload', tamano: 10 }), 'tipoArchivoInvalido');
  });
});

// -------------------------------------------------------------
// Acciones disponibles según rol y estado
// -------------------------------------------------------------

describe('accionesDisponibles', () => {
  test('el supervisor asignado puede aprobar, devolver o rechazar', () => {
    assert.deepEqual(accionesDisponibles(solicitud(), carlos), ['aprobar', 'devolver', 'rechazar']);
  });

  test('la solicitante puede cancelar mientras está en aprobación', () => {
    assert.deepEqual(accionesDisponibles(solicitud(), ana), ['cancelar']);
  });

  test('RH no tiene acciones hasta que se la asignan', () => {
    assert.deepEqual(accionesDisponibles(solicitud(), laura), []);
    const enRh = solicitud({ estadoActual: 'enGestionRh', etapaActual: 'gestionRh', asignadoA: 'laura' });
    assert.deepEqual(accionesDisponibles(enRh, laura), ['completar', 'rechazarRh']);
  });

  test('devuelta: la solicitante puede reenviar o cancelar', () => {
    const devuelta = solicitud({ estadoActual: 'devuelta', etapaActual: 'solicitud', asignadoA: 'ana' });
    assert.deepEqual(accionesDisponibles(devuelta, ana), ['reenviar', 'cancelar']);
    assert.equal(puedeCorregirDatos(devuelta, ana), true);
    assert.equal(puedeCorregirDatos(solicitud(), ana), false);
  });

  test('en un estado final nadie tiene acciones', () => {
    const completada = solicitud({ estadoActual: 'completada', etapaActual: 'finalizada', asignadoA: null });
    for (const usuario of [ana, carlos, laura, martin]) {
      assert.deepEqual(accionesDisponibles(completada, usuario), []);
    }
  });

  test('un usuario inactivo no tiene acciones', () => {
    assert.deepEqual(accionesDisponibles(solicitud(), { ...carlos, activo: false }), []);
  });
});

describe('puedeAgregarSeguimiento (notas y adjuntos)', () => {
  test('los participantes pueden; quien no participa, no', () => {
    assert.equal(puedeAgregarSeguimiento(solicitud(), ana), true);
    assert.equal(puedeAgregarSeguimiento(solicitud(), carlos), true);
    assert.equal(puedeAgregarSeguimiento(solicitud(), martin), false);
  });

  test('no se agregan notas a un trámite terminado', () => {
    const rechazada = solicitud({ estadoActual: 'rechazada', etapaActual: 'finalizada', asignadoA: null });
    assert.equal(puedeAgregarSeguimiento(rechazada, ana), false);
    lanzaError(() => construirEventoNota(rechazada, ana, 'hola'), 'seguimientoNoPermitido');
  });
});

// -------------------------------------------------------------
// Reparto rotativo de RH
// -------------------------------------------------------------

describe('elegirUsuarioRh', () => {
  test('reparte según el número entre los RH activos ordenados por nombre', () => {
    // Orden alfabético: Bruno (0), Laura (1).
    assert.equal(elegirUsuarioRh('SOL-0010', [laura, bruno]).id, 'bruno');
    assert.equal(elegirUsuarioRh('SOL-0011', [laura, bruno]).id, 'laura');
  });

  test('ignora a los RH inactivos', () => {
    assert.equal(elegirUsuarioRh('SOL-0010', [laura, { ...bruno, activo: false }]).id, 'laura');
  });

  test('falla si no hay RH activos', () => {
    lanzaError(() => elegirUsuarioRh('SOL-0010', []), 'sinRh');
  });
});

// -------------------------------------------------------------
// Transiciones
// -------------------------------------------------------------

describe('calcularTransicion', () => {
  const base = { numero: 'SOL-0011', solicitante: ana, supervisor: carlos, usuariosRh: [laura] };

  test('crear: queda en aprobación, asignada al supervisor y sin ver', () => {
    const { cambios, evento } = calcularTransicion({ ...base, accion: 'crear', solicitud: null, usuario: ana });
    assert.equal(cambios.estadoActual, 'enAprobacion');
    assert.equal(cambios.asignadoA, 'carlos');
    assert.equal(cambios.vistaPorAsignado, false);
    assert.deepEqual(cambios.participantes.sort(), ['ana', 'carlos']);
    assert.equal(evento.accion, 'creada');
    assert.equal(evento.estadoAnterior, null);
  });

  test('aprobar: pasa a RH y el evento registra el cambio de estado', () => {
    const { cambios, evento } = calcularTransicion({ ...base, accion: 'aprobar', solicitud: solicitud(), usuario: carlos });
    assert.equal(cambios.estadoActual, 'enGestionRh');
    assert.equal(cambios.asignadoA, 'laura');
    assert.equal(cambios.rolAsignado, 'rh');
    assert.deepEqual(cambios.participantes, ['ana', 'carlos', 'laura']);
    assert.deepEqual(
      [evento.accion, evento.usuarioId, evento.estadoAnterior, evento.estadoNuevo],
      ['aprobada', 'carlos', 'enAprobacion', 'enGestionRh'],
    );
  });

  test('devolver exige comentario y vuelve a la solicitante', () => {
    const parametros = { ...base, accion: 'devolver', solicitud: solicitud(), usuario: carlos };
    lanzaError(() => calcularTransicion({ ...parametros, comentario: '  ' }), 'comentarioObligatorio');
    const { cambios } = calcularTransicion({ ...parametros, comentario: 'Falta la firma' });
    assert.equal(cambios.estadoActual, 'devuelta');
    assert.equal(cambios.asignadoA, 'ana');
  });

  test('completar: queda finalizada, sin asignado y con los datos de RH', () => {
    const enRh = solicitud({ estadoActual: 'enGestionRh', etapaActual: 'gestionRh', asignadoA: 'laura', cantidadDias: 5 });
    const { cambios } = calcularTransicion({
      ...base,
      accion: 'completar',
      solicitud: enRh,
      usuario: laura,
      datosGestionRh: { referenciaRh: ' LIQ-2026-0042 ', diasDescontados: '5' },
    });
    assert.equal(cambios.estadoActual, 'completada');
    assert.equal(cambios.etapaActual, 'finalizada');
    assert.equal(cambios.asignadoA, null);
    assert.equal(cambios.vistaPorAsignado, true);
    assert.equal(cambios.referenciaRh, 'LIQ-2026-0042');
    assert.equal(cambios.diasDescontados, 5);
  });

  test('completar exige la referencia de liquidación', () => {
    const enRh = solicitud({ estadoActual: 'enGestionRh', etapaActual: 'gestionRh', asignadoA: 'laura', cantidadDias: 5 });
    lanzaError(
      () => calcularTransicion({ ...base, accion: 'completar', solicitud: enRh, usuario: laura, datosGestionRh: { referenciaRh: ' ', diasDescontados: 5 } }),
      'faltaReferenciaRh',
    );
  });

  test('crear deja los campos de RH vacíos; aprobar no los toca', () => {
    const creada = calcularTransicion({ ...base, accion: 'crear', solicitud: null, usuario: ana });
    assert.equal(creada.cambios.referenciaRh, null);
    assert.equal(creada.cambios.diasDescontados, null);
    const aprobada = calcularTransicion({ ...base, accion: 'aprobar', solicitud: solicitud(), usuario: carlos });
    assert.equal('referenciaRh' in aprobada.cambios, false);
  });

  test('la solicitante no puede aprobar su propia solicitud', () => {
    lanzaError(() => calcularTransicion({ ...base, accion: 'aprobar', solicitud: solicitud(), usuario: ana }), 'accionNoPermitida');
  });

  test('no se puede completar algo que todavía está en aprobación', () => {
    const lauraAsignada = solicitud({ asignadoA: 'laura' });
    lanzaError(() => calcularTransicion({ ...base, accion: 'completar', solicitud: lauraAsignada, usuario: laura }), 'accionNoPermitida');
  });

  test('crear falla si el supervisor está inactivo', () => {
    lanzaError(
      () => calcularTransicion({ ...base, supervisor: { ...carlos, activo: false }, accion: 'crear', solicitud: null, usuario: ana }),
      'sinSupervisor',
    );
  });
});

// -------------------------------------------------------------
// Control de campos por rol (MATRIZ_CAMPOS)
// -------------------------------------------------------------

describe('accesoACampos', () => {
  const campos = (acceso, ...nombres) => nombres.map((n) => acceso[n]);

  test('en aprobación: todos ven los datos del permiso sin editarlos; los campos RH se ocultan', () => {
    for (const usuario of [ana, carlos]) {
      const acceso = accesoACampos(solicitud(), usuario);
      assert.deepEqual(campos(acceso, 'tipoPermiso', 'motivo'), ['lectura', 'lectura']);
      assert.deepEqual(campos(acceso, 'referenciaRh', 'diasDescontados'), ['oculto', 'oculto']);
    }
  });

  test('devuelta: la solicitante edita los datos del permiso; el supervisor no', () => {
    const devuelta = solicitud({ estadoActual: 'devuelta', etapaActual: 'solicitud', asignadoA: 'ana' });
    assert.deepEqual(campos(accesoACampos(devuelta, ana), 'tipoPermiso', 'fechaInicio', 'fechaFin', 'motivo'), ['editable', 'editable', 'editable', 'editable']);
    assert.equal(accesoACampos(devuelta, carlos).motivo, 'lectura');
  });

  test('en gestión RH: el RH asignado edita sus campos; admin los ve; la solicitante no', () => {
    const enRh = solicitud({ estadoActual: 'enGestionRh', etapaActual: 'gestionRh', asignadoA: 'laura' });
    assert.deepEqual(campos(accesoACampos(enRh, laura), 'referenciaRh', 'diasDescontados'), ['editable', 'editable']);
    assert.equal(accesoACampos(enRh, laura).motivo, 'lectura');
    assert.equal(accesoACampos(enRh, martin).referenciaRh, 'lectura');
    assert.equal(accesoACampos(enRh, ana).referenciaRh, 'oculto');
  });

  test('un RH que no es el asignado no edita', () => {
    const enRh = solicitud({ estadoActual: 'enGestionRh', etapaActual: 'gestionRh', asignadoA: 'laura' });
    assert.equal(accesoACampos(enRh, bruno).referenciaRh, 'lectura');
  });

  test('completada: todos ven los campos de RH, nadie edita nada', () => {
    const completada = solicitud({ estadoActual: 'completada', etapaActual: 'finalizada', asignadoA: null });
    for (const usuario of [ana, carlos, laura, martin]) {
      const acceso = accesoACampos(completada, usuario);
      assert.deepEqual(campos(acceso, 'referenciaRh', 'diasDescontados', 'motivo'), ['lectura', 'lectura', 'lectura']);
    }
  });
});

describe('validarGestionRh', () => {
  test('acepta datos válidos y los normaliza', () => {
    assert.deepEqual(validarGestionRh({ referenciaRh: ' LIQ-1 ', diasDescontados: '0' }, 3), { referenciaRh: 'LIQ-1', diasDescontados: 0 });
  });

  test('rechaza días fuera de rango o no enteros', () => {
    for (const dias of ['', '4', '-1', '1.5', 'dos']) {
      lanzaError(() => validarGestionRh({ referenciaRh: 'LIQ-1', diasDescontados: dias }, 3), 'diasDescontadosInvalidos');
    }
  });

  test('rechaza referencias de más de 40 caracteres', () => {
    lanzaError(() => validarGestionRh({ referenciaRh: 'X'.repeat(41), diasDescontados: 1 }, 3), 'referenciaLarga');
  });
});

// -------------------------------------------------------------
// Orden del historial (BUGS.md · BUG-011)
// -------------------------------------------------------------

describe('ordenarHistorial', () => {
  /** Imita un Timestamp de Firestore: solo hace falta toMillis(). */
  const evento = (accion, milisegundos, comentario = null) => ({ accion, comentario, fecha: { toMillis: () => milisegundos } });
  const resumen = (eventos) => eventos.map((e) => `${e.accion}${e.comentario ? `:${e.comentario}` : ''}`);

  test('con la misma hora, "creada" va antes que sus adjuntos aunque Firestore los devuelva al revés', () => {
    // Así llegan cuando el id aleatorio del adjunto es "menor" que el de la creación.
    const deFirestore = [evento('adjuntoAgregado', 1000, 'b.pdf'), evento('adjuntoAgregado', 1000, 'a.pdf'), evento('creada', 1000)];
    assert.deepEqual(resumen(ordenarHistorial(deFirestore)), ['creada', 'adjuntoAgregado:b.pdf', 'adjuntoAgregado:a.pdf']);
  });

  test('ordena por hora, del más viejo al más nuevo', () => {
    const deFirestore = [evento('aprobada', 3000), evento('creada', 1000), evento('notaAgregada', 2000)];
    assert.deepEqual(resumen(ordenarHistorial(deFirestore)), ['creada', 'notaAgregada', 'aprobada']);
  });

  test('un adjunto posterior sigue después de los eventos anteriores', () => {
    const deFirestore = [evento('adjuntoAgregado', 2000, 'nuevo.pdf'), evento('aprobada', 3000), evento('creada', 1000)];
    assert.deepEqual(resumen(ordenarHistorial(deFirestore)), ['creada', 'adjuntoAgregado:nuevo.pdf', 'aprobada']);
  });

  test('no modifica el arreglo recibido y deja al final un evento todavía sin hora', () => {
    const sinHora = { accion: 'notaAgregada', comentario: null, fecha: null };
    const deFirestore = [sinHora, evento('creada', 1000)];
    const ordenado = ordenarHistorial(deFirestore);
    assert.deepEqual(resumen(ordenado), ['creada', 'notaAgregada']);
    assert.equal(deFirestore[0], sinHora);
  });
});
