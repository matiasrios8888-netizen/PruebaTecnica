/**
 * =============================================================
 * Tests UNITARIOS: gestión de roles
 * Archivo: scripts/tests/gestionRoles.test.mjs
 *
 * Responsabilidad:
 *   Probar src/services/gestionRoles.js sin Firebase ni navegador:
 *   catálogo de los 4 roles del sistema (estén o no guardados), roles
 *   faltantes, validación de lo editable y creación de un rol faltante.
 *
 * Uso (desde scripts/):  npm run test:unitarios
 *
 * Depende de: src/services/gestionRoles.js, src/config/constantes.js
 * =============================================================
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  armarCatalogoRoles,
  prepararRolFaltante,
  rolesFaltantes,
  rolPorDefecto,
  validarDatosRol,
} from '../../src/services/gestionRoles.js';
import { PERMISOS_POR_ROL } from '../../src/config/constantes.js';

/** Catálogo guardado sin el rol "rh" (como si alguien lo hubiera borrado de la base). */
const SIN_RH = [
  { id: 'iniciador', ...rolPorDefecto('iniciador') },
  { id: 'supervisor', ...rolPorDefecto('supervisor'), nombre: 'Jefe de área' },
  { id: 'admin', ...rolPorDefecto('admin') },
];

const USUARIOS = [
  { id: 'ana', rol: 'iniciador', activo: true },
  { id: 'pedro', rol: 'iniciador', activo: false },
  { id: 'laura', rol: 'rh', activo: true },
];

describe('catálogo de roles', () => {
  test('rolesFaltantes detecta los roles del sistema que no están guardados', () => {
    assert.deepEqual(rolesFaltantes(SIN_RH), ['rh']);
    assert.deepEqual(rolesFaltantes([...SIN_RH, { id: 'rh', ...rolPorDefecto('rh') }]), []);
  });

  test('siempre muestra los 4 roles: los guardados con sus datos y el faltante con los de fábrica', () => {
    const catalogo = armarCatalogoRoles(SIN_RH, USUARIOS);
    assert.deepEqual(catalogo.map((r) => r.clave), ['iniciador', 'supervisor', 'rh', 'admin']);
    assert.equal(catalogo[1].nombre, 'Jefe de área');

    const rh = catalogo[2];
    assert.equal(rh.existe, false);
    assert.equal(rh.nombre, 'Recursos Humanos');
    assert.equal(rh.usuariosActivos, 1);
  });

  test('cuenta los usuarios activos y totales de cada rol', () => {
    const iniciador = armarCatalogoRoles(SIN_RH, USUARIOS)[0];
    assert.equal(iniciador.usuariosActivos, 1);
    assert.equal(iniciador.usuariosTotales, 2);
  });
});

describe('validarDatosRol', () => {
  test('recorta espacios y exige nombre', () => {
    assert.deepEqual(validarDatosRol({ nombre: ' RRHH ', descripcion: ' Liquida ' }), { nombre: 'RRHH', descripcion: 'Liquida' });
    assert.throws(() => validarDatosRol({ nombre: '  ', descripcion: '' }), { codigo: 'nombreRolVacio' });
  });

  test('respeta los largos máximos', () => {
    assert.throws(() => validarDatosRol({ nombre: 'x'.repeat(61), descripcion: '' }), { codigo: 'nombreRolLargo' });
    assert.throws(() => validarDatosRol({ nombre: 'RRHH', descripcion: 'x'.repeat(301) }), { codigo: 'descripcionRolLarga' });
  });
});

describe('prepararRolFaltante', () => {
  test('recrea un rol faltante con el nombre elegido y los permisos de fábrica', () => {
    const rol = prepararRolFaltante('rh', { nombre: 'RRHH', descripcion: 'Gestiona permisos' }, SIN_RH);
    assert.deepEqual(rol, { nombre: 'RRHH', descripcion: 'Gestiona permisos', permisos: [...PERMISOS_POR_ROL.rh] });
  });

  test('no crea roles fuera de los 4 del sistema ni roles que ya existen', () => {
    assert.throws(() => prepararRolFaltante('auditor', { nombre: 'Auditor', descripcion: '' }, SIN_RH), {
      codigo: 'rolDesconocido',
    });
    assert.throws(() => prepararRolFaltante('admin', { nombre: 'Admin', descripcion: '' }, SIN_RH), { codigo: 'rolExistente' });
  });
});
