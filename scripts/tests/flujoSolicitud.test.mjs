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

  test('completar: queda finalizada y sin asignado', () => {
    const enRh = solicitud({ estadoActual: 'enGestionRh', etapaActual: 'gestionRh', asignadoA: 'laura' });
    const { cambios } = calcularTransicion({ ...base, accion: 'completar', solicitud: enRh, usuario: laura });
    assert.equal(cambios.estadoActual, 'completada');
    assert.equal(cambios.etapaActual, 'finalizada');
    assert.equal(cambios.asignadoA, null);
    assert.equal(cambios.vistaPorAsignado, true);
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
