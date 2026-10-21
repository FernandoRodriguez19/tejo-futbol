# Tejo Fútbol ⚽

Fútbol 1 vs 1 en cancha vertical: mezcla de Pong, Haxball y tejo. Hecho con Phaser 4 + Vite.

🎮 **Jugalo online:** https://tejo-futbol.vercel.app

## Modos
- **Liga Argentina:** elegís tu equipo entre 20 y jugás 19 fechas de 90 segundos. Se
  guarda solo.
- **1 vs 1** en el mismo teclado, o **contra el bot** (Fácil, Medio o Difícil), a 5 goles.

## Cómo jugar
- **Jugador 1 (azul, abajo):** W A S D para moverse, Espacio para patear.
- **Jugador 2 (rojo, arriba):** flechas para moverse, Enter para patear.
- **Hielo y jabón** (opcional, se elige antes de cada partido o al crear la liga):
  agarralos para tirárselos al rival. El hielo lo congela 5 s y el jabón lo hace patinar.
- **Dash** (barra que carga cada 30 s): Shift izquierdo (jugador 1), Shift derecho
  (jugador 2) o R1 en el joystick.
- **Joystick** (Xbox, PlayStation o USB genérico): stick o cruz para moverte, A / X / RT
  para patear, R1 para el dash, Start para pausar, B para volver. El primer joystick es el jugador 1 y el
  segundo el jugador 2. Si no lo detecta, apretá un botón del joystick con la página abierta.
- Cada rebote acelera la pelota.
- Amistosos: R reinicia al terminar el partido; Esc vuelve al menú.
- Liga: Esc pausa; en la tabla, Tab cambia de vista y N empieza una liga nueva.

## Correrlo en tu compu
```bash
npm install
npm run dev
```
Después abrí http://localhost:5173

## Publicar cambios
El repositorio está conectado a Vercel: **cada push a `main` se publica solo** en
https://tejo-futbol.vercel.app (Vercel corre `npm run build` y sirve `dist`).
```bash
git add -A
git commit -m "lo que cambiaste"
git push
```
Las otras ramas generan una versión de prueba con su propio link, sin tocar la oficial.
