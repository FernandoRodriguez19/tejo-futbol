# Plan de implementación — Tejo Fútbol

## Análisis del GDD: dudas encontradas y cómo se resolvieron
| Duda | Decisión |
|---|---|
| ¿Contra quién se juega? | 1 vs 1 en el mismo teclado o contra un bot. |
| ¿Qué pasa si la pelota toca al jugador sin patear? | Rebota en el círculo y pierde un poco de velocidad (el cuerpo amortigua). |
| ¿Hacia dónde sale la patada? | En la dirección centro del jugador → pelota, como en Haxball. |
| ¿La patada acelera más que un rebote? | Sí: la patada da un empujón fuerte; la pared, uno chico. |
| ¿La velocidad sube para siempre? | Sube con cada rebote hasta un tope alto. La física usa sub-pasos para que nunca atraviese nada. |
| ¿Dónde rebota la pelota? | En todas las paredes y en los postes; solo sale por la boca del arco. |
| ¿Cómo se gana? | El primero en llegar a 5 goles. |
| ¿Qué pasa después de un gol? | La velocidad vuelve a la normal y la pelota sale del medio hacia el que recibió el gol. |
| ¿Dificultad del bot? | Fácil, medio y difícil. |
| ¿Celular? | No, solo PC por ahora. |
| ¿Puede la pelota quedar yendo de lado a lado sin avanzar? | Se le fuerza un mínimo de movimiento vertical. |

## Pasos
- [x] 1. Proyecto base con Phaser + Vite y cancha vertical dibujada.
- [x] 2. Jugadores que se mueven libres dentro de su mitad.
- [x] 3. Pelota con física propia: rebotes en paredes, postes y cuerpos; aceleración por rebote.
- [x] 4. Patada con tecla (Espacio / Enter) en la dirección jugador → pelota.
- [x] 5. Arcos, goles, marcador, reinicio desde el medio y victoria a los 5 goles.
- [x] 6. Menú (1 vs 1 o bot con dificultad) y pantalla de fin.
- [x] 7. Bot con tres dificultades.
  - Corrección: el bot se hacía goles en contra empujando la pelota con el cuerpo y no
    atajaba los rebotes. Ahora se queda siempre entre la pelota y su arco, la rodea en vez
    de atravesarla, ataja como arquero cuando la pelota viene y tapa el palo si queda atrás.
- [x] 8. Sonidos (rebote, cuerpo, patada, gol, victoria).
- [x] 8b. Estética cartoon (estilo *Golazo!*) y cancha más grande con esquinas redondeadas.
- [x] 8c. Modo Liga Argentina: 20 equipos con colores reales, fixture de 19 fechas,
  partidos de 90 s con empate, tabla, simulación de los otros partidos, guardado y campeón.
- [x] 8d. Cantos de hinchada, repique de fondo, grito de gol, "uuuh" y música del menú.
- [x] 8e. Game juice: hit-stop, squash & stretch, pelota prendida fuego, textos de
  historieta, red y tribuna en los goles, cuenta regresiva, cámara dinámica, cámara lenta,
  repetición del gol, ojitos, polvo y pasto, transiciones entre pantallas.
- [x] 8f. Elegir equipos también en 1 vs 1 y contra el bot.
- [x] 9. Publicar en Vercel: https://tejo-futbol.vercel.app
- [x] 10. Menú con tarjetas e íconos (copa, jugadores, robot); la dificultad del bot se
  elige dentro de su tarjeta (ajíes). Botón de sonido en todas las pantallas (o tecla M):
  volumen alto → medio → mudo, y se recuerda.
- [x] 11. Hielo y jabón se ganan con la pelota: cuando la pelota choca con uno, se lo lleva
  el último que la tocó y le cae al rival. Pisarlos ya no hace nada y el bot no los busca.
- [x] 12. Diana debajo de cada power-up, cartel "¡PEGALE CON LA PELOTA!" hasta ganar el
  primero (se recuerda), y se rompen al pegarles. Golpes más fuertes (con limitador) y
  música/hinchada más bajas; todos los volúmenes en `AUDIO` de `src/config.js`.

## Ideas para después
- Controles táctiles para celular.
- Elegir cantidad de goles.
- Efectos visuales (estela de la pelota cuando va rápida).
