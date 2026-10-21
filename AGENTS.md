# AGENTS.md — Tejo Fútbol

Guía para agentes de IA (OpenCode, Claude Code, etc.) que trabajen en este proyecto.

## Proyecto
Juego de fútbol 1 vs 1 en cancha vertical (mezcla de Pong, Haxball y tejo) hecho con
**Phaser 4** y **Vite**, en JavaScript (ES modules). Se publica en **Vercel**.

- Diseño del juego: `docs/GDD.md` (leerlo antes de cambiar reglas).
- Plan de implementación y estado de cada paso: `docs/plan.md`.

## Comandos
- `npm install` — instala dependencias.
- `npm run dev` — servidor de desarrollo (http://localhost:5173).
- `npm run build` — genera la versión final en `dist/` (es lo que publica Vercel).
- `npm run preview` — sirve `dist/` para probar la build.

## Estructura
- `index.html` — página que carga el juego.
- `src/main.js` — configuración de Phaser y lista de escenas.
- `src/config.js` — todas las constantes del juego (tamaños, velocidades, goles para ganar).
- `src/sound.js` — efectos de sonido generados con Web Audio (no hay archivos de audio).
  Pasan por un refuerzo y un limitador; los volúmenes de todo el audio están en `AUDIO`
  de `src/config.js`.
- `src/music.js` — audio grabado (en `public/audio/`, copiado de `musica futbol tejo/`):
  música del menú (loop), música de fondo del partido (rotación de 4 temas que cambia en
  cada gol), cantos de hinchada (bajan la música mientras suenan), grito de gol y "uuuh". Los cantos se disparan desde
  `GameScene.updateChant()`; la música del menú, con `playMenuMusic()` de `src/ui.js`.
- `src/art.js` — todos los gráficos (cancha, tribuna, jugadores, pelota, explosión),
  dibujados con Canvas 2D al iniciar; no hay archivos de imagen.
- `src/ui.js` — textos con contorno, la cinta violeta de los carteles y el botón de
  sonido (`soundButton`, también con la tecla M). El volumen general vive en `sound.js`
  (`getVolume`, `cycleVolume`) y `music.js` lo aplica a todo el audio grabado.
- `src/scenes/MenuScene.js` — menú con dos secciones de tarjetas: Partido normal (vs IA,
  vs amigo) y Campeonato (liga, copa). La dificultad y los power-ups se
  eligen en la pantalla "antes de jugar" (`src/setupPanel.js`, clase `SetupPanel`,
  usada por `TeamSelectScene` y `NationSelectScene`).
- `src/scenes/GameScene.js` — partido: movimiento, física de la pelota, goles, fin.
  En modo liga además: reloj de 90 s, pausa y guardado del resultado.
- `src/scenes/TeamSelectScene.js` — elegir club para una liga nueva o un amistoso.
- `src/scenes/NationSelectScene.js` — selector de selección estilo FIFA para una copa nueva.
- `src/scenes/LeagueScene.js` — tabla, resultados de la fecha, próximo partido y campeón.
- `src/scenes/CupScene.js` — copa: grupos, llaves, resultados, próximo partido y campeón.
- `src/cup/nations.js` — las 48 selecciones (colores, fuerza, confederación, Mundiales).
- `src/cup/flags.js` — banderas de las 48 dibujadas con Canvas 2D (`flagTexture`).
- `src/cup/cup.js` — copa: sorteo de grupos, mejores terceros, llaves, simulación
  (penales), guardado en localStorage.
- Partidos de torneo: `GameScene` recibe `data.match` con `record(userGoals, rivalGoals)`
  y `back` (a dónde vuelve), así sirve igual para la liga y la copa; `knockout: true`
  activa el gol de oro.
- `src/league/teams.js` — los 20 equipos: colores (titular y suplente), fuerza y choque de camisetas.
- `src/league/league.js` — fixture, simulación, tabla, guardado en localStorage y bots por fuerza.
- `src/game/Bot.js` — inteligencia del bot (fácil, medio, difícil).
- `src/game/juice.js` — efectos: ojitos, red que se mueve, tribuna que salta, textos
  flotantes y detección de tiros al arco.
- `src/game/Particles.js` — partículas livianas (polvo, pasto, fuego) dibujadas en un Graphics.
- `src/game/Replay.js` — graba los últimos segundos para la repetición del gol.
- `src/game/Hazards.js` — power-ups opcionales (hielo y jabón): aparición, choque con la
  pelota (se los lleva `ball.lastTouch`, el último que la tocó), tiro al rival y efectos.
- `src/gamepads.js` — joystick (Gamepad API); `padMenu()` lo conecta a los menús.
- `GameScene` usa dos cámaras: la principal (zoom/seguimiento) y una de UI fija. Todo
  objeto nuevo va al mundo salvo que se cree dentro de `this.asUI(() => ...)`.
- Cambios de pantalla: usar `goTo(scene, key, data)` de `src/ui.js` y llamar
  `wipeIn(this)` al principio de cada `create()`.

## Convenciones
- Código y nombres en inglés; textos que ve el jugador y documentación en español.
- Los números del juego van en `src/config.js`, no sueltos en el código.
- La física de la pelota es propia (no usa Arcade Physics) y se calcula en sub-pasos
  para que la pelota nunca atraviese paredes ni jugadores. Mantener eso al cambiarla.
- Después de cada cambio: correr `npm run build` y probar el juego con `npm run dev`.
- Al terminar un paso del plan, marcarlo como hecho en `docs/plan.md`.
