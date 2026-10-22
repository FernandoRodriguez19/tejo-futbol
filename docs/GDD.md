# GDD — Tejo Fútbol

## Concepto
Juego de fútbol 1 vs 1 visto desde arriba, en una cancha **vertical**. Es una mezcla de
Pong, Haxball y el tejo (air hockey): cada jugador defiende su arco y trata de meter la
pelota en el arco rival. La pelota nunca frena y con cada rebote se hace más rápida.

## Plataforma
- Navegador de PC (teclado). No se juega en celular por ahora.
- Publicado en Vercel.

## Modos de juego
- **Liga Argentina:** elegís uno de los 20 equipos y jugás un torneo contra los demás (ver abajo).
- **1 vs 1 local:** dos personas en el mismo teclado.
- **Contra el bot:** dificultad fácil, media o difícil.
- En 1 vs 1 y contra el bot se eligen los dos equipos antes de jugar: primero el del
  jugador 1 y después el del jugador 2 (o el del bot). Se puede repetir equipo; el
  segundo usa la camiseta suplente. Contra el bot, la dificultad la define el nivel
  elegido, no el equipo.

## Liga Argentina
- 20 equipos con sus colores reales (sin escudos): River, Boca, Racing, Independiente,
  Estudiantes, Gimnasia, San Lorenzo, Huracán, Unión, Talleres, Rosario Central, Newell's,
  Vélez, Argentinos Juniors, Platense, Defensa y Justicia, Belgrano, Tigre, Banfield y
  Atlético Tucumán.
- Todos contra todos a una rueda: 19 fechas. Cada equipo es local 9 o 10 veces.
- Partidos de **90 segundos**; se puede empatar. Los últimos 10 segundos el reloj se pone
  rojo y suena un tic-tac. El reloj se frena durante el festejo de cada gol.
- Puntos: 3 por ganar, 1 por empatar (para los dos), 0 por perder.
- Tabla: Pts, PJ, G, E, P, GF, GC, DG. Desempate: diferencia de gol, después goles a favor.
- Cada fecha jugás tu partido; los otros 9 se simulan según la fuerza de cada equipo.
- **Fuerza de los equipos** (títulos, copas, historia y presente): define qué tan bien
  juega su bot y cómo le va en los partidos simulados. Se muestra con estrellas.
- **Dificultad de la liga** (fácil, medio o difícil), elegida al crearla: corre a todos
  los bots hacia arriba o hacia abajo, pero los grandes siempre juegan mejor que los chicos.
- Si dos camisetas se parecen, el visitante usa la alternativa.
- Esc pausa el partido: podés seguir o abandonar (cuenta como derrota 0-3).
- El progreso se guarda solo en el navegador; se puede empezar una liga nueva cuando quieras.
- Al terminar: pantalla de campeón con copa, o tu posición final y quién salió campeón.

## Cancha
- Rectángulo vertical grande (680 × 920) con **esquinas redondeadas**, un arco arriba
  (rival) y uno abajo (jugador 1). La pelota rebota también en la curva de las esquinas.
- Línea de mitad de cancha: cada jugador se mueve libre **solo dentro de su mitad**.
- La pelota rebota en **todas** las paredes. Solo puede salir por la boca de los arcos (gol).

## Jugadores
- Son círculos (como en Haxball).
- Movimiento libre en 8 direcciones dentro de su mitad.
- **Cuerpo:** si la pelota toca al jugador sin que patee, rebota en el círculo y
  **pierde un poco de velocidad** (el cuerpo amortigua).
- **Patada:** con una tecla. Si la pelota está cerca, sale disparada en la dirección
  *centro del jugador → pelota*, con un empujón fuerte. Hay una espera corta entre patadas.

## Dash
- Cada jugador arranca el partido **con el dash cargado**, y en cada saque después de un
  gol se vuelve a llenar. Una vez usado, la barra tarda **30 segundos** de juego en
  llenarse (no carga durante los festejos ni las repeticiones). Se ve abajo del marcador y
  como un anillo alrededor del jugador (amarillo cuando está lista).
- Con la barra llena y moviéndote, el dash te impulsa unos 130 px en la dirección en que
  vas: sirve para volver a defender o subir a atacar, pero no cruza la cancha (y nunca
  te deja pasar a la mitad rival).
- Teclas: Shift izquierdo (jugador 1), Shift derecho (jugador 2; contra el bot, cualquiera
  de los dos) y R1 en el joystick.
- **Super zapatazo:** si pateás en el medio de un dash, la patada sale un 35% más fuerte.
- El bot guarda el dash para cuando le conviene (ver "Bot").

## Copa de naciones
- 48 selecciones elegidas por historia y presente, repartidas como un Mundial de 48:
  16 de Europa, 8 de Sudamérica, 6 de Norte y Centroamérica, 9 de África, 8 de Asia y
  1 de Oceanía. Colores reales (Croacia con cuadros); cada una tiene su fuerza y su
  bandera (dibujada en el juego).
- Selector estilo FIFA: pestañas por confederación, una tarjeta grande con la bandera,
  la camiseta, el nivel, las estrellas y las Copas del Mundo ganadas, y abajo la tira de
  banderas de esa confederación. ← → recorre las 48, ↑ ↓ cambia de confederación.
- Después de elegir la selección, en "antes de jugar":
  - **Formato:** fase de grupos o eliminación directa.
  - **Equipos:** con grupos 48 (12 grupos), 32, 16 u 8 (2 grupos); en eliminación
    directa 32, 16, 8 o 4. Si se achica, juegan los mejores (y siempre tu selección).
  - **Dificultad** y **power-ups**, como en la liga.
- Grupos de 4 sorteados por bombos (como en el Mundial), 3 fechas, 3 puntos por ganar y
  1 por empatar. Pasan los 2 primeros; con 12 grupos también los 8 mejores terceros.
- Eliminación: llaves sembradas (los mejores se cruzan al final). Partidos de 90 s; si
  terminan empatados, **gol de oro**: se sigue jugando hasta el próximo gol. Los partidos
  simulados que empatan se definen por penales (marcados con *).
- Si te eliminan, podés simular el resto para ver quién sale campeón.
- Se guarda sola y se puede abandonar para empezar otra.

## Hielo y jabón (opcional)
- Se activa en la pantalla "ANTES DE JUGAR" (después de elegir los equipos en 1 vs 1 o
  contra el bot, y al crear la liga, junto con la dificultad).
- Cada 6 a 12 segundos de juego aparece en una mitad al azar un **cubo de hielo** o un
  **jabón** (máximo 2 a la vez). Dura 9 segundos y titila antes de desaparecer.
- Son **power-ups contra el rival** y se ganan **con la pelota**: cuando la pelota choca
  con uno, se lo lleva el último que tocó la pelota (con una patada o con el cuerpo,
  aunque después haya rebotado en las paredes) y sale volando girando hacia el otro
  jugador. Pasar caminando por encima no hace nada. Justo después de un saque, antes de
  que alguien toque la pelota, la pelota pasa por encima sin activarlo.
- Cada uno aparece sobre una **diana roja y blanca** pintada en el pasto, para que se
  entienda que hay que pegarle. Hasta que el jugador gana uno por primera vez, también
  muestra el cartel "¡PEGALE CON LA PELOTA!"; después se guarda en el navegador y no
  aparece más.
- Al pegarle, el hielo **estalla en pedazos** ("¡CRASH!") y el jabón **en burbujas**
  ("¡PLOP!"), con un mini freno y temblor de cámara, y sale volando al rival.
- **Hielo:** el rival queda congelado 2 s: no se puede mover ni usar el dash.
- **Jabón:** el rival patina 3 s con muy poco agarre: le cuesta mucho frenar y doblar.
- Se borran en cada saque.

## Controles
| Acción | Jugador 1 (abajo) | Jugador 2 (arriba) |
|---|---|---|
| Moverse | W A S D | Flechas |
| Patear | Espacio | Enter |
| Pausa / menú | Esc | Esc |

## Pelota y velocidad
- Nunca frena (sin fricción).
- Cada rebote contra una pared la acelera un poco.
- La patada la acelera bastante más.
- Chocar contra un cuerpo la frena un poco.
- Tiene una velocidad máxima alta para que nunca atraviese paredes ni jugadores.

## Goles y partido
- Gana el primero que llega a **5 goles**.
- Después de cada gol la pelota vuelve a la velocidad normal y sale del centro hacia
  el jugador que **recibió** el gol.
- Al inicio del partido la pelota sale hacia un jugador al azar.

## Bot
Cuatro niveles que suben de a escalones parejos:
- Muy fácil (pensado para chicos): muy lento, reacciona tarde, no anticipa la pelota,
  ataca poco, sus patadas son flojas y su cuerpo frena la pelota. No usa el dash.
- Fácil: juega de verdad pero lento y se equivoca bastante; patea la mitad de las veces,
  con patadas un poco más flojas, y a veces no va a buscar la pelota. No usa el dash.
- Medio: partido parejo. Defiende y patea casi siempre. Usa el dash solo para salvar un
  gol que caminando no llega a tapar.
- Difícil: rápido, anticipa la trayectoria y apunta al arco. Usa el dash para salvar
  goles y para meter un super zapatazo cuando tiene la pelota de frente apuntando al arco.

## Aspecto y sonido
- Estilo cartoon inspirado en *Golazo!*: colores saturados, contornos oscuros gruesos,
  pasto verde lima con franjas, tribuna con público de colores y carteles de publicidad.
- Jugadores tipo dibujo animado con sombra, brillo y número (azul 10, rojo 9).
- Pelota clásica blanca y negra que gira, con estela cuando va rápida.
- Efectos: explosión amarilla en cada patada, cartel "¡GOLAZO!" con cinta violeta y
  papelitos en cada gol.
- Fuentes: Bungee (títulos) y Rubik (textos).
- Sonidos simples generados por el navegador: rebote, patada, gol y victoria.
- Música en loop en el menú, la elección de equipo y la tabla de la liga.
- Música de fondo del partido: después del canto de inicio suena una de 4 (el repique y
  3 canciones), al azar. Cada vez que hay un gol o que termina, cambia por otra distinta.
  Baja el volumen cuando suena un canto.
- Grito de gol grabado en cada gol y "uuuh" grabado en los palos y las que pasan cerca.
- Cantos de hinchada (grabaciones reales, volumen bajo, suenan una vez cada uno):
  - al empezar el partido;
  - cuando vas perdiendo por 2 o 3 goles;
  - cuando vas perdiendo por 4 o más (reemplaza al anterior).
  Contra el bot cuentan para el jugador 1; en 1 vs 1, para el que vaya perdiendo. Si
  descontás y volvés a quedar abajo, suena de nuevo. Se cortan con un fundido al terminar.

## Game juice
- Hit-stop: el juego se congela un instante en las patadas fuertes y los pelotazos.
- Squash & stretch: la pelota se estira cuando va rápido y se aplasta al rebotar; los
  jugadores se achatan al patear o recibir un golpe.
- Pelota prendida fuego cerca de la velocidad máxima ("¡A FUEGO!").
- Textos de historieta: "¡ZAPATAZO!", "¡ATAJADA!", "¡PALO!" (con sonido metálico),
  "¡UUUH!" en las que pasan cerca del palo y "¡10 REBOTES!" en los peloteos largos.
- Gol: la red se infla y vibra, la tribuna salta, el marcador late, papelitos, flash.
- Cuenta regresiva "3, 2, 1, ¡YA!" al empezar; "¡YA!" en cada saque.
- Cámara dinámica (zoom suave que sigue la pelota), cámara lenta en las jugadas
  decisivas (punto de partido o últimos segundos de la liga) y al pegar en el palo.
- Repetición en cámara lenta de cada gol (se saltea con Espacio/Enter).
- Ojitos de dibujo animado que siguen la pelota: parpadean, se enojan al cargar la
  patada, festejan (^ ^) o quedan mareados (x x) después de un gol.
- Polvo al correr y pasto que salta en las patadas.
- Transiciones con franjas diagonales entre pantallas.

## Pantallas
1. Menú con dos secciones:
   - **Partido normal:** VS LA IA o VS AMIGO.
   - **Campeonato:** LIGA (clubes) y COPA (selecciones).
2. Elegir equipos (uno en la liga, los dos en los partidos normales).
3. "Antes de jugar": dificultad (contra la IA y en la liga) y power-ups sí/no. Recuerda la
   última elección.
4. Partido: marcador arriba.
5. Fin: muestra quién ganó y deja jugar de nuevo o volver al menú.
