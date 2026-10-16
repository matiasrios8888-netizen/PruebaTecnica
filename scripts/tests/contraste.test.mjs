/**
 * =============================================================
 * Tests de ACCESIBILIDAD: contraste de colores (WCAG 2.1 AA)
 * Archivo: scripts/tests/contraste.test.mjs
 *
 * Responsabilidad:
 *   Leer las variables de color de src/styles/main.css (modo claro y modo
 *   oscuro) y comprobar que cada par de texto y fondo que usa la app tenga
 *   el contraste mínimo de WCAG: 4,5:1 para texto y 3:1 para elementos que
 *   no son texto (bordes de campos, anillo de foco). Si alguien cambia un
 *   color y rompe el contraste, este test falla.
 *
 * Uso (desde scripts/):  npm run test:unitarios
 *
 * Depende de: src/styles/main.css
 * =============================================================
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../../src/styles/main.css', import.meta.url), 'utf8');

/** Variables "--nombre: #rrggbb" de un bloque que empieza con "inicio". */
function variablesDelBloque(inicio) {
  const desde = css.indexOf(inicio);
  assert.notEqual(desde, -1, `No se encontró el bloque ${inicio}`);
  const bloque = css.slice(desde, css.indexOf('}', desde));
  return Object.fromEntries([...bloque.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
}

const CLARO = variablesDelBloque(':root {');
const OSCURO = { ...CLARO, ...variablesDelBloque('@media (prefers-color-scheme: dark) {\n  :root {') };

/** Luminancia relativa de un color (fórmula de WCAG 2.1). */
function luminancia(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const canal = parseInt(hex.slice(i, i + 2), 16) / 255;
    return canal <= 0.03928 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Relación de contraste entre dos colores (de 1:1 a 21:1). */
function contraste(a, b) {
  const [clara, oscura] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (clara + 0.05) / (oscura + 0.05);
}

/** [variable del texto, variable del fondo, mínimo, dónde se usa] */
const PARES = [
  ['color-texto', 'color-superficie', 4.5, 'texto sobre panel'],
  ['color-texto', 'color-fondo', 4.5, 'texto sobre fondo'],
  ['color-texto-suave', 'color-superficie', 4.5, 'texto secundario sobre panel'],
  ['color-texto-suave', 'color-fondo', 4.5, 'texto secundario sobre fondo'],
  ['color-texto-suave', 'color-superficie-hundida', 4.5, 'texto de un campo deshabilitado'],
  ['color-primario', 'color-superficie', 4.5, 'enlace sobre panel'],
  ['color-primario', 'color-fondo', 4.5, 'enlace y pestaña activa sobre fondo'],
  ['color-sobre-primario', 'color-primario', 4.5, 'texto del botón principal'],
  ['color-sobre-tinta', 'color-tinta', 4.5, 'texto del encabezado'],
  ['color-sobre-tinta-suave', 'color-tinta', 4.5, 'secciones y rol del encabezado'],
  ['color-error', 'color-error-fondo', 4.5, 'mensaje de error'],
  ['color-error', 'color-superficie', 4.5, 'botón de peligro'],
  ['color-ok', 'color-ok-fondo', 4.5, 'etiqueta de estado ok'],
  ['color-alerta', 'color-alerta-fondo', 4.5, 'etiqueta y mensaje de alerta'],
  ['color-pendiente', 'color-pendiente-fondo', 4.5, 'etiqueta de estado pendiente'],
  ['color-sobre-nueva', 'color-nueva', 4.5, 'etiqueta "Nueva" y su contador'],
  ['color-texto-suave', 'color-borde-suave', 4.5, 'etiqueta neutra (dado de baja, cancelada)'],
  ['color-texto', 'color-borde-suave', 4.5, 'contador de pestaña'],
  ['color-tooltip-texto', 'color-tooltip-fondo', 4.5, 'valor del tooltip'],
  ['color-tooltip-suave', 'color-tooltip-fondo', 4.5, 'etiqueta del tooltip'],
  ['color-borde-control', 'color-superficie', 3, 'borde de los campos (no es texto)'],
  ['color-primario', 'color-superficie', 3, 'anillo de foco sobre panel (no es texto)'],
  ['color-primario', 'color-fondo', 3, 'anillo de foco sobre fondo (no es texto)'],
];

describe('contraste (WCAG 2.1 AA)', () => {
  test('la fórmula da los valores conocidos: negro sobre blanco 21:1 y un color consigo mismo 1:1', () => {
    assert.equal(contraste('#000000', '#ffffff').toFixed(1), '21.0');
    assert.equal(contraste('#1c5cab', '#1c5cab'), 1);
  });

  for (const [modo, colores] of [['claro', CLARO], ['oscuro', OSCURO]]) {
    test(`modo ${modo}: todos los pares de texto y fondo cumplen el mínimo`, () => {
      const fallas = PARES.map(([texto, fondo, minimo, uso]) => {
        assert.ok(colores[texto] && colores[fondo], `Falta la variable --${texto} o --${fondo}`);
        const valor = contraste(colores[texto], colores[fondo]);
        return valor >= minimo ? null : `${uso}: ${valor.toFixed(2)}:1 (mínimo ${minimo}:1)`;
      }).filter(Boolean);
      assert.deepEqual(fallas, []);
    });
  }
});
