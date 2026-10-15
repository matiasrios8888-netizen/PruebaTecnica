/**
 * =============================================================
 * Punto de entrada de la aplicación
 * Archivo: src/main.js
 *
 * Responsabilidad:
 *   - Registrar las pantallas en el router (con sus restricciones de rol).
 *   - Esperar a que Firebase informe si hay una sesión (puede estar recordada
 *     de una visita anterior) y recién ahí dibujar la primera pantalla.
 *   - Volver a resolver la ruta cada vez que alguien inicia o cierra sesión.
 *
 * Depende de: src/services/authServicio.js, src/ui/router.js, src/ui/pantallas/*,
 *   src/config/constantes.js
 * =============================================================
 */

import { observarSesion, obtenerUsuarioActual } from './services/authServicio.js';
import { ROLES } from './config/constantes.js';
import {
  registrarRuta,
  iniciarRouter,
  resolverRuta,
  navegar,
  RUTA_LOGIN,
  RUTA_INICIO,
  RUTA_NUEVA_SOLICITUD,
  RUTA_DETALLE_SOLICITUD,
} from './ui/router.js';
import { renderizarLogin } from './ui/pantallas/loginPantalla.js';
import { renderizarInicio } from './ui/pantallas/inicioPantalla.js';
import { renderizarNuevaSolicitud } from './ui/pantallas/nuevaSolicitudPantalla.js';
import { renderizarDetalleSolicitud } from './ui/pantallas/detalleSolicitudPantalla.js';

const contenedor = document.getElementById('app');

registrarRuta(RUTA_LOGIN, renderizarLogin, { publica: true });
registrarRuta(RUTA_INICIO, renderizarInicio);
// ⚠️ IMPORTANTE: solo el iniciador crea solicitudes (también lo exigen el servicio y las reglas).
registrarRuta(RUTA_NUEVA_SOLICITUD, renderizarNuevaSolicitud, { roles: [ROLES.INICIADOR] });
// Cualquier usuario logueado puede pedir un detalle; si no le corresponde verlo,
// firestore.rules rechaza la lectura y la pantalla muestra el error.
registrarRuta(RUTA_DETALLE_SOLICITUD, renderizarDetalleSolicitud);

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
