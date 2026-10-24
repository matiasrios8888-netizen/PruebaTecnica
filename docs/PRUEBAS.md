# Pruebas

Cómo se prueba la aplicación y cuál fue el resultado de la última ejecución completa (Fase 6, 2026-10-15).

Hay tres niveles:
1. **Tests automáticos** (`npm test` desde `scripts/`): lógica pura, reglas de seguridad y contraste de colores.
2. **Guion de pruebas por rol**: recorrido de punta a punta en el navegador con las cuentas de demostración, sobre los datos del seed.
3. **Controles de diseño y accesibilidad**: desborde en celulares, contraste y uso con teclado.

---

## 1. Tests automáticos

| Suite | Archivo | Tests | Qué cubre |
|---|---|---|---|
| Flujo | `scripts/tests/flujoSolicitud.test.mjs` | 42 | Transiciones por rol, validaciones, control de campos, reparto de RH, orden del historial |
| Bandeja | `scripts/tests/bandeja.test.mjs` | 16 | Pestañas por rol, búsqueda sin tildes, filtros y orden |
| Usuarios | `scripts/tests/gestionUsuarios.test.mjs` | 21 | Validación de datos, bloqueos de baja y cambio de rol, reactivación |
| Roles | `scripts/tests/gestionRoles.test.mjs` | 7 | Catálogo, roles faltantes, permisos de fábrica |
| Reportes | `scripts/tests/reportes.test.mjs` | 9 | Distribución por etapa, carga por usuario |
| Contraste | `scripts/tests/contraste.test.mjs` | 3 | Los 23 pares de texto y fondo cumplen WCAG AA, en claro y en oscuro |
| Reglas | `scripts/tests/reglas.test.mjs` | 73 | `firestore.rules` contra el emulador: quién puede leer y escribir qué |
| **Total** | | **171** | |

```bash
cd scripts
npm test                # todo (los de reglas necesitan Java y Firebase CLI)
npm run test:unitarios  # solo lógica y contraste, sin Firebase
npm run test:reglas     # solo reglas, con el emulador
```

---

## 2. Guion de pruebas por rol

**Preparación:** `npm run seed` (desde `scripts/`) deja 6 usuarios, 10 solicitudes y el contador en 10. El ingreso se hace con los botones de "Cuentas de demostración" del login. El guion se ejecuta en este orden, porque cada rol continúa el trámite del anterior.

**Resultado de la última ejecución:** 23 de 23 casos correctos. En R4 se ajustó lo esperado (ver la nota del caso).

### General
| ID | Prueba | Resultado esperado | Resultado |
|---|---|---|---|
| G1 | Ingresar con una contraseña incorrecta | "Email o contraseña incorrectos." | ✅ |
| G2 | Ingresar como `pedro.ruiz@bprosys.test` (dado de baja) | "Tu usuario está dado de baja. Contactá al administrador." | ✅ |
| G3 | Ingresar solo con el teclado (Tab y Enter) | Entra a la bandeja | ✅ |
| G4 | Salir con un aviso a la vista | El login queda sin avisos (BUG-008) | ✅ |

### Iniciador (Ana Gómez)
| ID | Prueba | Resultado esperado | Resultado |
|---|---|---|---|
| I1 | Ver la bandeja | Pendientes 1, Nuevas 1, Enviadas 9; sin "Todas". Menú: Bandeja y Nueva solicitud | ✅ |
| I2 | Pedir un permiso por enfermedad sin adjunto | "Enfermedad requiere adjuntar documentación…" | ✅ |
| I3 | Pedir un permiso personal de 1 día | Se crea SOL-0011, esperando a Carlos Pérez | ✅ |
| I4 | Corregir el motivo de SOL-0004 (devuelta) y reenviarla | Vuelve a Carlos Pérez | ✅ |
| I5 | Agregar una nota | El historial suma un evento | ✅ |
| I6 | Escribir `#/usuarios` y `#/reportes` en la barra | Vuelve a la bandeja | ✅ |

### Supervisor (Carlos Pérez)
| ID | Prueba | Resultado esperado | Resultado |
|---|---|---|---|
| S1 | Ver la bandeja | Pendientes 5 (incluye SOL-0011 y SOL-0004 reenviada); sin "Todas". Menú: Bandeja | ✅ |
| S2 | Devolver SOL-0001 sin comentario | "Escribí un comentario explicando el motivo." | ✅ |
| S3 | Aprobar SOL-0011 | Pasa a Laura Fernández (Recursos Humanos) | ✅ |
| S4 | Escribir `#/bandeja/todas` | Vuelve a Pendientes | ✅ |

### Recursos Humanos (Laura Fernández)
| ID | Prueba | Resultado esperado | Resultado |
|---|---|---|---|
| R1 | Ver la bandeja | Tiene la pestaña Todas (11). Menú: Bandeja y Reportes | ✅ |
| R2 | Completar SOL-0011 sin referencia | "Ingresá la referencia de liquidación para completar la gestión." | ✅ |
| R3 | Completarla con `LIQ-2026-1201` y 1 día | Trámite finalizado: el recorrido muestra las 4 etapas hechas | ✅ |
| R4 | Ver los reportes | Trámites 11 · En curso 7 · Finalizados 4 · Sin abrir 4 | ✅ (*) |
| C1 | (como Ana) Abrir SOL-0011 | Ve la referencia `LIQ-2026-1201` en solo lectura | ✅ |

(*) El guion esperaba "Sin abrir 2", pero el valor correcto es **4**, y es el que mostró la app. Las tareas nuevas son SOL-0003 y SOL-0004 de Carlos (la reenviada vuelve como nueva) y SOL-0005 y SOL-0007 de Laura. El error estaba en el guion, no en la app.

### Administrador (Martín Sosa)
| ID | Prueba | Resultado esperado | Resultado |
|---|---|---|---|
| A1 | Ver el menú | Bandeja, Reportes, Usuarios, Roles | ✅ |
| A2 | Abrir la ficha de Carlos Pérez | La baja está bloqueada, con 2 motivos (trámites abiertos y colaboradora a cargo) | ✅ |
| A3 | Abrir Roles | Las 4 tarjetas del sistema | ✅ |
| A4 | Escribir `#/solicitudes/nueva` | Vuelve a la bandeja (el admin no crea solicitudes) | ✅ |

Los casos de mantenimiento con más detalle (alta, alta interrumpida, reactivación bloqueada, rol perdido) y los de los reportes están en `BITACORA.md`, en los pasos de las Fases 4 y 5.

---

## 3. Controles de diseño y accesibilidad

| Control | Cómo | Resultado |
|---|---|---|
| Desborde horizontal | 9 pantallas (bandeja, nueva solicitud, detalle con y sin acciones, usuarios, alta, ficha, roles, reportes) × 1280 / 390 / 320 px | 0 px en todas |
| Contraste | 23 pares de texto y fondo × modo claro y oscuro (test automático) | Todos cumplen WCAG AA |
| Paletas de los gráficos | Validador de paletas (daltonismo, banda de luminosidad, contraste) en claro y oscuro | Todas pasan |
| Teclado | Login con Tab y Enter; tooltips de los gráficos con Tab; foco visible en todos los controles | Funciona |
| Lectores de pantalla | Un solo `<main>`, título de pestaña por pantalla, `aria-current` en el menú y en el recorrido, tablas de datos de los gráficos | Revisado |
| Consola | Sin errores, salvo el `400` esperado de una contraseña incorrecta (OBS-001) | Revisado |
