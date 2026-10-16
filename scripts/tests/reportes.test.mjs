/**
 * =============================================================
 * Tests UNITARIOS: reportes de gestión
 * Archivo: scripts/tests/reportes.test.mjs
 *
 * Responsabilidad:
 *   Probar src/services/reportes.js sin Firebase ni navegador:
 *   distribución por etapa (a partir de conteos por estado) y carga de
 *   pendientes por usuario. También verifica que ETAPA_DE_ESTADO coincida
 *   con la tabla TRANSICIONES.
 *
 * Uso (desde scripts/):  npm run test:unitarios
 *
 * Depende de: src/services/reportes.js, src/config/constantes.js
 * =============================================================
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { cargaPorUsuario, distribucionPorEtapa } from '../../src/services/reportes.js';
import { ESTADOS_ABIERTOS, ETAPA_DE_ESTADO, TRANSICIONES } from '../../src/config/constantes.js';

const DIA = 24 * 60 * 60 * 1000;
const AHORA = Date.UTC(2026, 9, 15, 12);

/** Simula un Timestamp de Firestore creado hace "dias" días. */
const haceDias = (dias) => ({ toMillis: () => AHORA - dias * DIA });

const USUARIOS = [
  { id: 'ana', nombre: 'Ana Gómez', rol: 'iniciador', activo: true },
  { id: 'carlos', nombre: 'Carlos Pérez', rol: 'supervisor', activo: true },
  { id: 'sofia', nombre: 'Sofía Díaz', rol: 'supervisor', activo: true },
  { id: 'laura', nombre: 'Laura Fernández', rol: 'rh', activo: true },
  { id: 'martin', nombre: 'Martín Sosa', rol: 'admin', activo: true },
  { id: 'pedro', nombre: 'Pedro Ruiz', rol: 'iniciador', activo: false },
];

/** Solicitud abierta asignada a "asignadoA". */
const abierta = (numero, asignadoA, { vista = true, dias = 1 } = {}) => ({
  id: `id-${numero}`,
  numero,
  asignadoA,
  asignadoNombre: `Nombre de ${asignadoA}`,
  vistaPorAsignado: vista,
  fechaCreacion: haceDias(dias),
});

describe('ETAPA_DE_ESTADO', () => {
  test('coincide con la etapa a la que lleva cada transición', () => {
    for (const transicion of Object.values(TRANSICIONES)) {
      assert.equal(ETAPA_DE_ESTADO[transicion.estadoNuevo], transicion.etapaNueva);
    }
  });

  test('los estados abiertos son los que no están finalizados', () => {
    assert.deepEqual([...ESTADOS_ABIERTOS], ['enAprobacion', 'devuelta', 'enGestionRh']);
  });
});

describe('distribucionPorEtapa', () => {
  // Los datos de prueba del seed: 3 en aprobación, 1 devuelta, 3 en RH, 2 completadas, 1 rechazada.
  const SEED = { enAprobacion: 3, devuelta: 1, enGestionRh: 3, completada: 2, rechazada: 1 };

  test('suma los estados en su etapa, en el orden del proceso', () => {
    const { total, abiertos, etapas } = distribucionPorEtapa(SEED);
    assert.equal(total, 10);
    assert.equal(abiertos, 7);
    assert.deepEqual(
      etapas.map((e) => [e.etapa, e.cantidad, e.porcentaje]),
      [['solicitud', 1, 10], ['aprobacion', 3, 30], ['gestionRh', 3, 30], ['finalizada', 3, 30]],
    );
  });

  test('el detalle por estado incluye solo los estados con trámites', () => {
    const finalizada = distribucionPorEtapa(SEED).etapas.at(-1);
    assert.deepEqual(finalizada.estados.map((e) => [e.estado, e.cantidad]), [['completada', 2], ['rechazada', 1]]);
  });

  test('sin trámites, todo en 0 y sin dividir por cero', () => {
    const { total, etapas } = distribucionPorEtapa({});
    assert.equal(total, 0);
    assert.ok(etapas.every((e) => e.cantidad === 0 && e.porcentaje === 0));
  });
});

describe('cargaPorUsuario', () => {
  const ABIERTAS = [
    abierta('SOL-0001', 'carlos', { vista: false, dias: 2 }),
    abierta('SOL-0002', 'carlos', { dias: 5 }),
    abierta('SOL-0003', 'carlos', { vista: false, dias: 1 }),
    abierta('SOL-0004', 'ana', { vista: false, dias: 6 }),
    abierta('SOL-0005', 'laura', { dias: 3 }),
  ];

  test('cuenta pendientes y nuevas por persona, de mayor a menor carga', () => {
    const { filas, totalPendientes, totalNuevas } = cargaPorUsuario(ABIERTAS, USUARIOS, AHORA);
    assert.deepEqual(
      filas.map((f) => [f.usuarioId, f.pendientes, f.nuevas]),
      [['carlos', 3, 2], ['ana', 1, 1], ['laura', 1, 0], ['sofia', 0, 0]],
    );
    assert.equal(totalPendientes, 5);
    assert.equal(totalNuevas, 3);
  });

  test('informa el trámite más antiguo de cada bandeja', () => {
    const carlos = cargaPorUsuario(ABIERTAS, USUARIOS, AHORA).filas[0];
    assert.deepEqual(carlos.masAntiguo, { id: 'id-SOL-0002', numero: 'SOL-0002', dias: 5 });
  });

  test('lista con 0 a supervisores y RH activos; no a iniciadores ni admin sin tareas', () => {
    const ids = cargaPorUsuario([], USUARIOS, AHORA).filas.map((f) => f.usuarioId);
    assert.deepEqual(ids, ['carlos', 'laura', 'sofia']);
  });

  test('marca como problema un trámite asignado a alguien dado de baja o inexistente', () => {
    const { conProblemas } = cargaPorUsuario(
      [abierta('SOL-0009', 'pedro'), abierta('SOL-0010', 'fantasma')],
      USUARIOS,
      AHORA,
    );
    assert.deepEqual(conProblemas.map((f) => [f.usuarioId, f.nombre]), [
      ['fantasma', 'Nombre de fantasma'],
      ['pedro', 'Pedro Ruiz'],
    ]);
  });
});
