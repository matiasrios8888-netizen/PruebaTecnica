/**
 * =============================================================
 * Punto de entrada de la aplicación
 * Archivo: src/main.js
 *
 * Responsabilidad (provisoria, sub-paso 3.1): comprobar que el SDK de
 *   Firebase se carga desde el CDN y que la app queda inicializada.
 *   En el próximo sub-paso se reemplaza por el router y el login.
 *
 * Depende de: src/config/firebase.js
 * =============================================================
 */

import { app } from './config/firebase.js';

const contenedor = document.getElementById('app');
contenedor.textContent = `Firebase inicializado ✔ – proyecto: ${app.options.projectId}`;
console.info('[main] Firebase inicializado', app.options.projectId);
