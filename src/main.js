/**
 * =============================================================
 * Punto de entrada de la aplicación
 * Archivo: src/main.js
 *
 * Responsabilidad:
 *   - Registrar las pantallas en el router.
 *   - Esperar a que Firebase informe si hay una sesión (puede estar recordada
 *     de una visita anterior) y recién ahí dibujar la primera pantalla.
 *   - Volver a resolver la ruta cada vez que alguien inicia o cierra sesión.
 *
 * Depende de: src/services/authServicio.js, src/ui/router.js,
 *   src/ui/pantallas/loginPantalla.js, src/ui/pantallas/inicioPantalla.js
 * =============================================================
 */

import { observarSesion, obtenerUsuarioActual } from './services/authServicio.js';
import {
  registrarRuta,
  iniciarRouter,
  resolverRuta,
  navegar,
  RUTA_LOGIN,
  RUTA_INICIO,
} from './ui/router.js';
import { renderizarLogin } from './ui/pantallas/loginPantalla.js';
import { renderizarInicio } from './ui/pantallas/inicioPantalla.js';

const contenedor = document.getElementById('app');

registrarRuta(RUTA_LOGIN, renderizarLogin, { publica: true });
registrarRuta(RUTA_INICIO, renderizarInicio);

iniciarRouter(contenedor, obtenerUsuarioActual);

// Firebase avisa el estado de la sesión al cargar y en cada login/logout.
// Hasta el primer aviso se ve "Cargando…" (del index.html), así no parpadea el login.
observarSesion((usuario) => {
  if (usuario) {
    resolverRuta(); // respeta la ruta pedida (si era #/login, el router lleva a inicio)
  } else {
    navegar(RUTA_LOGIN);
  }
});
