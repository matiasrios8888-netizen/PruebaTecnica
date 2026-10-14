# Bitácora del proyecto

Registro paso a paso de lo que se construyó. Las decisiones técnicas importantes están en `DECISIONES.md`.

---

## 2026-10-14 – Fase 1 – Paso: reglas del proyecto y repositorio

- **Qué hicimos:** dejamos escritas las reglas de trabajo del proyecto, ignoramos los archivos que no deben subirse, inicializamos git y conectamos el repositorio de GitHub. Creamos la rama `feature/fase-1-base`, donde se va a construir toda la Fase 1.
- **Archivos creados o modificados:**
  - `CLAUDE.md`: reglas de trabajo (ritmo, comentarios, datos, git, documentación, bitácora), stack, arquitectura, enunciado y plan por fases. Claude Code lo lee al empezar cada sesión.
  - `.gitignore`: lista de archivos que git no debe seguir (clave privada de Firebase, `node_modules`, logs, `.env`).
  - `BITACORA.md`: este archivo, el registro paso a paso.
- **Conceptos aprendidos:**
  - **Repositorio git:** carpeta cuyo historial de cambios guarda git. Cada *commit* es una "foto" del proyecto con un mensaje que explica qué cambió.
  - **Rama (branch):** línea de trabajo paralela. `main` siempre funciona; las funcionalidades nuevas se hacen en ramas `feature/...` y se unen a `main` (merge) cuando están terminadas.
  - **Remoto (`origin`):** la copia del repositorio en GitHub. `push` sube los commits; `pull` baja los cambios.
  - **`.gitignore`:** evita subir por error secretos (como la clave de cuenta de servicio de Firebase, que da acceso total a la base) o archivos que se pueden regenerar.
- **Comandos usados:**
  - `git init -b main`: crea el repositorio local con la rama principal llamada `main`.
  - `git add CLAUDE.md BITACORA.md .gitignore`: prepara (*stage*) esos archivos para el próximo commit.
  - `git commit -m "chore: reglas del proyecto, bitácora y .gitignore"`: guarda la foto con su mensaje. `chore:` indica una tarea de mantenimiento o configuración, no una funcionalidad.
  - `git remote add origin <url>`: le dice al repo local dónde está la copia en GitHub.
  - `git push -u origin main`: sube `main` a GitHub; `-u` recuerda la conexión para que después alcance con `git push`.
  - `git switch -c feature/fase-1-base`: crea la rama de la fase y se mueve a ella.
  - `git push -u origin feature/fase-1-base`: publica la rama nueva en GitHub.
- **Cómo probarlo:**
  - `git status` → dice `On branch feature/fase-1-base` y no hay nada pendiente.
  - `git log --oneline` → aparece el primer commit.
  - En GitHub se ven los 3 archivos en `main` y la rama `feature/fase-1-base`.
- **Pendientes o dudas:** en el Paso 2 se presenta la arquitectura y el modelo de datos para aprobarlos antes de escribir código.
