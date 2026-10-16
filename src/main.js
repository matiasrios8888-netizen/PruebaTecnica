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
 *   src/ui/utils/avisos.js, src/config/constantes.js
 * =============================================================
 */

import { observarSesion, obtenerUsuarioActual } from './services/authServicio.js';
import { ROLES, ROLES_VEN_REPORTES } from './config/constantes.js';
import {
  registrarRuta,
  iniciarRouter,
  resolverRuta,
  navegar,
  RUTA_LOGIN,
  RUTA_INICIO,
  RUTA_BANDEJA_PESTANA,
  RUTA_NUEVA_SOLICITUD,
  RUTA_DETALLE_SOLICITUD,
  RUTA_USUARIOS,
  RUTA_NUEVO_USUARIO,
  RUTA_FICHA_USUARIO,
  RUTA_ROLES,
  RUTA_REPORTES,
} from './ui/router.js';
import { renderizarLogin } from './ui/pantallas/loginPantalla.js';
import { renderizarBandeja } from './ui/pantallas/bandejaPantalla.js';
import { renderizarNuevaSolicitud } from './ui/pantallas/nuevaSolicitudPantalla.js';
import { renderizarDetalleSolicitud } from './ui/pantallas/detalleSolicitudPantalla.js';
import { renderizarUsuarios } from './ui/pantallas/usuariosPantalla.js';
import { renderizarAltaUsuario } from './ui/pantallas/altaUsuarioPantalla.js';
import { renderizarFichaUsuario } from './ui/pantallas/fichaUsuarioPantalla.js';
import { renderizarRoles } from './ui/pantallas/rolesPantalla.js';
import { renderizarReportes } from './ui/pantallas/reportesPantalla.js';
import { limpiarAvisos } from './ui/utils/avisos.js';

const contenedor = document.getElementById('app');

registrarRuta(RUTA_LOGIN, renderizarLogin, { publica: true });
registrarRuta(RUTA_INICIO, renderizarBandeja); // #/bandeja → pestaña Pendientes
registrarRuta(RUTA_BANDEJA_PESTANA, renderizarBandeja);
// ⚠️ IMPORTANTE: solo el iniciador crea solicitudes (también lo exigen el servicio y las reglas).
registrarRuta(RUTA_NUEVA_SOLICITUD, renderizarNuevaSolicitud, { roles: [ROLES.INICIADOR] });
// Cualquier usuario logueado puede pedir un detalle; si no le corresponde verlo,
// firestore.rules rechaza la lectura y la pantalla muestra el error.
registrarRuta(RUTA_DETALLE_SOLICITUD, renderizarDetalleSolicitud);
// 🔒 SEGURIDAD: el mantenimiento es solo del admin (también lo exigen los servicios y las reglas).
registrarRuta(RUTA_USUARIOS, renderizarUsuarios, { roles: [ROLES.ADMIN] });
registrarRuta(RUTA_NUEVO_USUARIO, renderizarAltaUsuario, { roles: [ROLES.ADMIN] });
registrarRuta(RUTA_FICHA_USUARIO, renderizarFichaUsuario, { roles: [ROLES.ADMIN] });
registrarRuta(RUTA_ROLES, renderizarRoles, { roles: [ROLES.ADMIN] });
// 🔒 SEGURIDAD: los reportes son de RH y admin (también lo exigen el servicio y las reglas).
registrarRuta(RUTA_REPORTES, renderizarReportes, { roles: [...ROLES_VEN_REPORTES] });

iniciarRouter(contenedor, obtenerUsuarioActual);

// Firebase avisa el estado de la sesión al cargar y en cada login/logout.
// Hasta el primer aviso se ve "Cargando…" (del index.html), así no parpadea el login.
observarSesion((usuario) => {
  if (usuario) {
    resolverRuta(); // respeta la ruta pedida (si era #/login, el router lleva a inicio)
  } else {
    // Los avisos de la sesión anterior no tienen que verlos quien entra después (BUGS.md · BUG-008).
    limpiarAvisos();
    navegar(RUTA_LOGIN);
  }
});
