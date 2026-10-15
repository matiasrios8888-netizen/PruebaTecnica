/**
 * =============================================================
 * Tests UNITARIOS: mantenimiento de usuarios
 * Archivo: scripts/tests/gestionUsuarios.test.mjs
 *
 * Responsabilidad:
 *   Probar src/services/gestionUsuarios.js sin Firebase ni navegador:
 *   validación de datos (email, rol, supervisor), contraseña inicial,
 *   motivos que bloquean una baja o un cambio de rol, reactivación y
 *   búsqueda/filtros del listado.
 *
 * Uso (desde scripts/):  npm run test:unitarios
 *
 * Depende de: src/services/gestionUsuarios.js
 * =============================================================
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  colaboradoresActivos,
  filtrarUsuarios,
  filtrosUsuariosVacios,
  motivosDeBloqueo,
  supervisoresDisponibles,
  tramitesAbiertos,
  validarContrasenaInicial,
  validarDatosUsuario,
  validarReactivacion,
} from '../../src/services/gestionUsuarios.js';

// -------------------------------------------------------------
// Datos de prueba
// -------------------------------------------------------------

const ana = { id: 'ana', nombre: 'Ana Gómez', email: 'iniciador@bprosys.test', rol: 'iniciador', area: 'Operaciones', supervisorId: 'carlos', activo: true };
const carlos = { id: 'carlos', nombre: 'Carlos Pérez', email: 'supervisor@bprosys.test', rol: 'supervisor', area: 'Operaciones', supervisorId: null, activo: true };
const laura = { id: 'laura', nombre: 'Laura Fernández', email: 'rh@bprosys.test', rol: 'rh', area: 'Recursos Humanos', supervisorId: null, activo: true };
const martin = { id: 'martin', nombre: 'Martín Sosa', email: 'admin@bprosys.test', rol: 'admin', area: 'Sistemas', supervisorId: null, activo: true };
const sofia = { id: 'sofia', nombre: 'Sofía Díaz', email: 'sofia.diaz@bprosys.test', rol: 'supervisor', area: 'Comercial', supervisorId: null, activo: true };
const pedro = { id: 'pedro', nombre: 'Pedro Ruiz', email: 'pedro.ruiz@bprosys.test', rol: 'iniciador', area: 'Comercial', supervisorId: 'sofia', activo: false };

const USUARIOS = [ana, carlos, laura, martin, sofia, pedro];

/** Datos válidos de un iniciador nuevo, con algunos cambios. */
const datosNuevo = (cambios = {}) => ({
  nombre: 'Lucía Torres',
  email: 'lucia.torres@bprosys.test',
  rol: 'iniciador',
  area: 'Ventas',
  supervisorId: 'carlos',
  ...cambios,
});

/** Contexto de motivosDeBloqueo con Martín operando. */
const contexto = (cambios = {}) => ({
  operacion: 'baja',
  usuarioActual: martin,
  usuarios: USUARIOS,
  solicitudes: [],
  ...cambios,
});

const abierta = (numero) => ({ numero, estadoActual: 'enAprobacion' });
const cerrada = (numero) => ({ numero, estadoActual: 'completada' });

// -------------------------------------------------------------
// Validación de datos
// -------------------------------------------------------------

describe('validarDatosUsuario', () => {
  test('normaliza: recorta espacios y pasa el email a minúsculas', () => {
    const datos = validarDatosUsuario(
      datosNuevo({ nombre: '  Lucía Torres ', email: ' Lucia.Torres@Bprosys.TEST ', area: ' Ventas ' }),
      { usuarios: USUARIOS },
    );
    assert.deepEqual(datos, {
      nombre: 'Lucía Torres',
      email: 'lucia.torres@bprosys.test',
      rol: 'iniciador',
      area: 'Ventas',
      supervisorId: 'carlos',
    });
  });

  test('los roles que no son iniciador no llevan supervisor', () => {
    const datos = validarDatosUsuario(datosNuevo({ rol: 'rh', supervisorId: 'carlos' }), { usuarios: USUARIOS });
    assert.equal(datos.supervisorId, null);
  });

  test('rechaza nombre vacío, email inválido, rol desconocido y área vacía', () => {
    const opciones = { usuarios: USUARIOS };
    assert.throws(() => validarDatosUsuario(datosNuevo({ nombre: '   ' }), opciones), { codigo: 'nombreVacio' });
    assert.throws(() => validarDatosUsuario(datosNuevo({ email: 'lucia@' }), opciones), { codigo: 'emailInvalido' });
    assert.throws(() => validarDatosUsuario(datosNuevo({ rol: 'auditor' }), opciones), { codigo: 'rolInvalido' });
    assert.throws(() => validarDatosUsuario(datosNuevo({ area: '' }), opciones), { codigo: 'areaVacia' });
  });

  test('el email no se puede repetir (sin importar mayúsculas), salvo el del propio usuario', () => {
    assert.throws(
      () => validarDatosUsuario(datosNuevo({ email: 'SUPERVISOR@bprosys.test' }), { usuarios: USUARIOS }),
      { codigo: 'emailEnUso' },
    );
    // Editar a Ana conservando su email no es un email repetido.
    const datos = validarDatosUsuario({ ...ana, area: 'Ventas' }, { id: 'ana', usuarios: USUARIOS });
    assert.equal(datos.area, 'Ventas');
  });

  test('el iniciador necesita un supervisor con rol supervisor, que no sea él mismo', () => {
    const opciones = { usuarios: USUARIOS };
    assert.throws(() => validarDatosUsuario(datosNuevo({ supervisorId: '' }), opciones), { codigo: 'sinSupervisor' });
    assert.throws(() => validarDatosUsuario(datosNuevo({ supervisorId: 'laura' }), opciones), { codigo: 'sinSupervisor' });
    // Carlos pasa a iniciador y se elige a sí mismo como supervisor.
    assert.throws(
      () => validarDatosUsuario({ ...carlos, rol: 'iniciador', supervisorId: 'carlos' }, { id: 'carlos', usuarios: USUARIOS }),
      { codigo: 'sinSupervisor' },
    );
  });

  test('un usuario activo necesita un supervisor activo; uno dado de baja, no', () => {
    const conSofiaDeBaja = USUARIOS.map((u) => (u.id === 'sofia' ? { ...u, activo: false } : u));
    assert.throws(
      () => validarDatosUsuario(datosNuevo({ supervisorId: 'sofia' }), { usuarios: conSofiaDeBaja }),
      { codigo: 'supervisorInactivo' },
    );
    const datos = validarDatosUsuario({ ...pedro, area: 'Ventas' }, { id: 'pedro', activo: false, usuarios: conSofiaDeBaja });
    assert.equal(datos.supervisorId, 'sofia');
  });
});

describe('validarContrasenaInicial', () => {
  test('exige al menos 8 caracteres', () => {
    assert.throws(() => validarContrasenaInicial('corta1'), { codigo: 'contrasenaCorta' });
    assert.doesNotThrow(() => validarContrasenaInicial('Inicial2026'));
  });
});

// -------------------------------------------------------------
// Bloqueos
// -------------------------------------------------------------

describe('motivosDeBloqueo', () => {
  test('un usuario sin trámites abiertos ni dependencias se puede dar de baja', () => {
    assert.deepEqual(motivosDeBloqueo(sofia, contexto()), []);
  });

  test('el admin no se puede dar de baja ni cambiar su propio rol', () => {
    assert.deepEqual(motivosDeBloqueo(martin, contexto()), ['No podés darte de baja a vos mismo.']);
    assert.deepEqual(motivosDeBloqueo(martin, contexto({ operacion: 'cambioRol', rolNuevo: 'rh' })), [
      'No podés cambiar tu propio rol.',
    ]);
  });

  test('los trámites abiertos bloquean (con sus números); los finalizados no', () => {
    const motivos = motivosDeBloqueo(ana, contexto({ solicitudes: [abierta('SOL-0004'), cerrada('SOL-0008'), abierta('SOL-0001')] }));
    assert.deepEqual(motivos, ['Participa en 2 trámites abiertos (SOL-0001, SOL-0004): tienen que finalizar antes.']);
    assert.deepEqual(motivosDeBloqueo(ana, contexto({ solicitudes: [cerrada('SOL-0008')] })), []);
  });

  test('un supervisor con colaboradores activos no se da de baja (los inactivos no cuentan)', () => {
    assert.deepEqual(motivosDeBloqueo(carlos, contexto()), [
      'Es supervisor de 1 colaborador activo (Ana Gómez): asignales otro supervisor antes.',
    ]);
    // Sofía solo tiene a Pedro, que está dado de baja.
    assert.deepEqual(colaboradoresActivos(sofia, USUARIOS), []);
  });

  test('el último RH activo no se da de baja; si hay otro RH activo, sí', () => {
    assert.equal(motivosDeBloqueo(laura, contexto()).length, 1);
    const otroRh = { ...laura, id: 'rh2', nombre: 'Otro RH', email: 'rh2@bprosys.test' };
    assert.deepEqual(motivosDeBloqueo(laura, contexto({ usuarios: [...USUARIOS, otroRh] })), []);
  });

  test('cambio de rol: mismo rol no es un cambio; dejar de ser supervisor o RH aplica los mismos bloqueos', () => {
    assert.deepEqual(motivosDeBloqueo(carlos, contexto({ operacion: 'cambioRol', rolNuevo: 'supervisor' })), []);
    assert.equal(motivosDeBloqueo(carlos, contexto({ operacion: 'cambioRol', rolNuevo: 'iniciador' })).length, 1);
    assert.equal(motivosDeBloqueo(laura, contexto({ operacion: 'cambioRol', rolNuevo: 'admin' })).length, 1);
    assert.deepEqual(motivosDeBloqueo(sofia, contexto({ operacion: 'cambioRol', rolNuevo: 'rh' })), []);
  });

  test('se juntan todos los motivos que apliquen', () => {
    const motivos = motivosDeBloqueo(carlos, contexto({ solicitudes: [abierta('SOL-0002')] }));
    assert.equal(motivos.length, 2);
  });
});

describe('validarReactivacion', () => {
  test('un iniciador se reactiva solo si su supervisor está activo', () => {
    assert.doesNotThrow(() => validarReactivacion(pedro, USUARIOS));
    const conSofiaDeBaja = USUARIOS.map((u) => (u.id === 'sofia' ? { ...u, activo: false } : u));
    assert.throws(() => validarReactivacion(pedro, conSofiaDeBaja), { codigo: 'supervisorInactivo' });
  });

  test('no se reactiva a alguien que ya está activo', () => {
    assert.throws(() => validarReactivacion(ana, USUARIOS), { codigo: 'yaActivo' });
  });
});

// -------------------------------------------------------------
// Consultas y listado
// -------------------------------------------------------------

describe('listas auxiliares', () => {
  test('supervisoresDisponibles: solo supervisores activos, por nombre; incluye el actual si se pide', () => {
    assert.deepEqual(supervisoresDisponibles(USUARIOS).map((u) => u.id), ['carlos', 'sofia']);
    const conSofiaDeBaja = USUARIOS.map((u) => (u.id === 'sofia' ? { ...u, activo: false } : u));
    assert.deepEqual(supervisoresDisponibles(conSofiaDeBaja).map((u) => u.id), ['carlos']);
    assert.deepEqual(supervisoresDisponibles(conSofiaDeBaja, { incluirId: 'sofia' }).map((u) => u.id), ['carlos', 'sofia']);
  });

  test('tramitesAbiertos: sin los finalizados y ordenados por número', () => {
    const lista = [abierta('SOL-0005'), cerrada('SOL-0003'), { numero: 'SOL-0002', estadoActual: 'devuelta' }];
    assert.deepEqual(tramitesAbiertos(lista).map((s) => s.numero), ['SOL-0002', 'SOL-0005']);
  });
});

describe('filtrarUsuarios', () => {
  test('sin filtros devuelve todos ordenados por nombre', () => {
    assert.deepEqual(filtrarUsuarios(USUARIOS, filtrosUsuariosVacios()).map((u) => u.id), [
      'ana', 'carlos', 'laura', 'martin', 'pedro', 'sofia',
    ]);
  });

  test('la búsqueda ignora tildes y mayúsculas y busca cada palabra en nombre, email y área', () => {
    const buscar = (texto) => filtrarUsuarios(USUARIOS, { ...filtrosUsuariosVacios(), texto }).map((u) => u.id);
    assert.deepEqual(buscar('GOMEZ'), ['ana']);
    assert.deepEqual(buscar('comercial'), ['pedro', 'sofia']);
    assert.deepEqual(buscar('sofia comercial'), ['sofia']);
    assert.deepEqual(buscar('bprosys.test rh'), ['laura']);
  });

  test('filtra por rol y por estado', () => {
    const filtrar = (cambios) => filtrarUsuarios(USUARIOS, { ...filtrosUsuariosVacios(), ...cambios }).map((u) => u.id);
    assert.deepEqual(filtrar({ rol: 'supervisor' }), ['carlos', 'sofia']);
    assert.deepEqual(filtrar({ estado: 'inactivos' }), ['pedro']);
    assert.deepEqual(filtrar({ rol: 'iniciador', estado: 'activos' }), ['ana']);
  });
});
