/**
 * =============================================================
 * Tests UNITARIOS: lógica pura de la bandeja
 * Archivo: scripts/tests/bandeja.test.mjs
 *
 * Responsabilidad:
 *   Probar src/services/bandeja.js sin Firebase ni navegador: pestañas por
 *   rol, contenido de cada pestaña, búsqueda (sin tildes ni mayúsculas),
 *   filtros (incluido el rango de fechas por superposición) y orden.
 *
 * Uso (desde scripts/):  npm run test:unitarios
 *
 * Depende de: src/services/bandeja.js
 * =============================================================
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  armarPestanas,
  contarPestanas,
  coincideBusqueda,
  filtrarSolicitudes,
  filtrosVacios,
  hayFiltrosActivos,
  normalizarTexto,
  ordenarSolicitudes,
  pestanasVisibles,
  procesarBandeja,
} from '../../src/services/bandeja.js';

// -------------------------------------------------------------
// Datos de prueba
// -------------------------------------------------------------

/** Simula un Timestamp de Firestore. */
const ts = (milisegundos) => ({ toMillis: () => milisegundos });

const carlos = { id: 'carlos', rol: 'supervisor' };
const laura = { id: 'laura', rol: 'rh' };

const SOLICITUDES = [
  {
    numero: 'SOL-0001', tipoPermiso: 'vacaciones', estadoActual: 'enAprobacion', etapaActual: 'aprobacion',
    solicitanteNombre: 'Ana Gómez', asignadoA: 'carlos', asignadoNombre: 'Carlos Pérez', vistaPorAsignado: false,
    motivo: 'Viaje a la costa', fechaInicio: '2026-11-03', fechaFin: '2026-11-07', fechaActualizacion: ts(300),
  },
  {
    numero: 'SOL-0002', tipoPermiso: 'personal', estadoActual: 'enAprobacion', etapaActual: 'aprobacion',
    solicitanteNombre: 'Ana Gómez', asignadoA: 'carlos', asignadoNombre: 'Carlos Pérez', vistaPorAsignado: true,
    motivo: 'Trámite en el banco', fechaInicio: '2026-10-20', fechaFin: '2026-10-20', fechaActualizacion: ts(500),
  },
  {
    numero: 'SOL-0011', tipoPermiso: 'maternidadPaternidad', estadoActual: 'enGestionRh', etapaActual: 'gestionRh',
    solicitanteNombre: 'Pedro Ruiz', asignadoA: 'laura', asignadoNombre: 'Laura Fernández', vistaPorAsignado: false,
    motivo: 'Nacimiento', fechaInicio: '2026-12-01', fechaFin: '2026-12-15', fechaActualizacion: ts(100),
  },
  {
    numero: 'SOL-0008', tipoPermiso: 'enfermedad', estadoActual: 'completada', etapaActual: 'finalizada',
    solicitanteNombre: 'Ana Gómez', asignadoA: null, asignadoNombre: null, vistaPorAsignado: true,
    motivo: 'Gripe', fechaInicio: '2026-09-01', fechaFin: '2026-09-03', fechaActualizacion: ts(200),
  },
];

const numeros = (lista) => lista.map((s) => s.numero);

// -------------------------------------------------------------
// Pestañas
// -------------------------------------------------------------

describe('pestañas', () => {
  test('"Todas" solo para RH y admin', () => {
    assert.deepEqual(pestanasVisibles(carlos), ['pendientes', 'nuevas', 'enviadas']);
    assert.deepEqual(pestanasVisibles(laura), ['pendientes', 'nuevas', 'enviadas', 'todas']);
    assert.ok(pestanasVisibles({ id: 'x', rol: 'admin' }).includes('todas'));
    assert.ok(!pestanasVisibles({ id: 'x', rol: 'iniciador' }).includes('todas'));
  });

  test('pendientes, nuevas y enviadas del supervisor', () => {
    const asignadas = SOLICITUDES.filter((s) => s.asignadoA === 'carlos');
    const participa = SOLICITUDES; // participó de todas (para el ejemplo)
    const pestanas = armarPestanas({ asignadas, participa }, carlos);
    assert.deepEqual(numeros(pestanas.pendientes), ['SOL-0001', 'SOL-0002']);
    assert.deepEqual(numeros(pestanas.nuevas), ['SOL-0001']); // la 0002 ya la vio
    assert.deepEqual(numeros(pestanas.enviadas), ['SOL-0011', 'SOL-0008']); // ya no las tiene él
    assert.equal(pestanas.todas, undefined);
    assert.deepEqual(contarPestanas(pestanas), { pendientes: 2, nuevas: 1, enviadas: 2 });
  });

  test('"Todas" se arma solo si el rol puede verla', () => {
    const consultas = { asignadas: [], participa: [], todas: SOLICITUDES };
    assert.equal(armarPestanas(consultas, laura).todas.length, 4);
    assert.equal(armarPestanas(consultas, carlos).todas, undefined);
  });
});

// -------------------------------------------------------------
// Búsqueda
// -------------------------------------------------------------

describe('búsqueda', () => {
  test('normaliza tildes y mayúsculas', () => {
    assert.equal(normalizarTexto('  Gómez PÉREZ '), 'gomez perez');
  });

  test('busca en número, solicitante, tipo y motivo', () => {
    assert.ok(coincideBusqueda(SOLICITUDES[0], 'sol-0001'));
    assert.ok(coincideBusqueda(SOLICITUDES[0], 'gomez'));
    assert.ok(coincideBusqueda(SOLICITUDES[0], 'COSTA'));
    assert.ok(coincideBusqueda(SOLICITUDES[2], 'paternidad')); // nombre del tipo
    assert.ok(coincideBusqueda(SOLICITUDES[0], 'carlos')); // asignado
  });

  test('con varias palabras exige todas', () => {
    assert.ok(coincideBusqueda(SOLICITUDES[0], 'ana vacaciones'));
    assert.ok(!coincideBusqueda(SOLICITUDES[1], 'ana vacaciones'));
  });

  test('texto vacío no filtra', () => {
    assert.equal(filtrarSolicitudes(SOLICITUDES, { texto: '   ' }).length, 4);
  });
});

// -------------------------------------------------------------
// Filtros
// -------------------------------------------------------------

describe('filtros', () => {
  test('por estado, etapa y tipo', () => {
    assert.deepEqual(numeros(filtrarSolicitudes(SOLICITUDES, { estado: 'enAprobacion' })), ['SOL-0001', 'SOL-0002']);
    assert.deepEqual(numeros(filtrarSolicitudes(SOLICITUDES, { etapa: 'finalizada' })), ['SOL-0008']);
    assert.deepEqual(numeros(filtrarSolicitudes(SOLICITUDES, { tipoPermiso: 'personal' })), ['SOL-0002']);
  });

  test('rango de fechas por superposición', () => {
    // Del 05/11 al 30/11: entra la 0001 (03/11–07/11) aunque empezó antes.
    assert.deepEqual(numeros(filtrarSolicitudes(SOLICITUDES, { desde: '2026-11-05', hasta: '2026-11-30' })), ['SOL-0001']);
    // Solo "desde": permisos que terminan ese día o después.
    assert.deepEqual(numeros(filtrarSolicitudes(SOLICITUDES, { desde: '2026-11-01' })), ['SOL-0001', 'SOL-0011']);
  });

  test('los filtros se combinan', () => {
    assert.deepEqual(numeros(filtrarSolicitudes(SOLICITUDES, { texto: 'ana', etapa: 'aprobacion', tipoPermiso: 'vacaciones' })), ['SOL-0001']);
  });

  test('hayFiltrosActivos', () => {
    assert.equal(hayFiltrosActivos(filtrosVacios()), false);
    assert.equal(hayFiltrosActivos({ ...filtrosVacios(), estado: 'devuelta' }), true);
  });
});

// -------------------------------------------------------------
// Orden
// -------------------------------------------------------------

describe('orden', () => {
  test('por última actualización', () => {
    assert.deepEqual(numeros(ordenarSolicitudes(SOLICITUDES, 'recientes')), ['SOL-0002', 'SOL-0001', 'SOL-0008', 'SOL-0011']);
    assert.deepEqual(numeros(ordenarSolicitudes(SOLICITUDES, 'antiguas')), ['SOL-0011', 'SOL-0008', 'SOL-0001', 'SOL-0002']);
  });

  test('por fecha de inicio', () => {
    assert.deepEqual(numeros(ordenarSolicitudes(SOLICITUDES, 'inicioProximo')), ['SOL-0008', 'SOL-0002', 'SOL-0001', 'SOL-0011']);
  });

  test('por número', () => {
    assert.deepEqual(numeros(ordenarSolicitudes(SOLICITUDES, 'numeroDesc')), ['SOL-0011', 'SOL-0008', 'SOL-0002', 'SOL-0001']);
  });

  test('no modifica la lista original', () => {
    const original = numeros(SOLICITUDES);
    ordenarSolicitudes(SOLICITUDES, 'numeroAsc');
    assert.deepEqual(numeros(SOLICITUDES), original);
  });

  test('procesarBandeja filtra y ordena', () => {
    assert.deepEqual(numeros(procesarBandeja(SOLICITUDES, { texto: 'ana' }, 'numeroDesc')), ['SOL-0008', 'SOL-0002', 'SOL-0001']);
  });
});
