# 🎲 LUDO PARTY — Reglas Completas del Juego

## Objetivo
Mover las 4 fichas desde tu base (casa 🏠) alrededor del tablero hasta la meta 🏁. El primer jugador en llevar las 4 fichas a casa gana.

## Tablero
- **52 casillas** en recorrido circular (cross pattern)
- **4 bases** (esquinas): Rojo (abajo-izq), Verde (arriba-izq), Amarillo (arriba-der), Azul (abajo-der)
- **4 home stretches** (corredor final): 5 casillas cada uno (posiciones 52-56)
- Posición 56 = meta (ficha llega a casa 🏁)

## Inicio
- Cada jugador tiene **4 fichas** en su base (posición -1)
- Para **entrar al tablero**: necesitas sacar **6** en el dado (regla Ludo Club)
- Al entrar, la ficha se coloca en la casilla de entrada de tu color
  - Rojo → casilla 0
  - Verde → casilla 13
  - Amarillo → casilla 26
  - Azul → casilla 39

## Turnos
1. El jugador actual **tira el dado** (1-6, completamente aleatorio)
2. Si puede mover alguna ficha, **selecciona cuál mover**
3. Si NO puede mover NINGUNA ficha, el turno pasa automáticamente
4. **Sacar 6 = turno extra** (el mismo jugador vuelve a tirar)
5. **Tres 6s consecutivos = turno perdido** (el tercer 6 anula el turno)
6. **Capturar una ficha = tirada extra** (regla Ludo Club)
7. **Meter una ficha en meta = tirada extra** (regla Ludo Club)

## Movimiento
- Una ficha se mueve hacia adelante según el valor del dado
- Las fichas avanzan en sentido horario alrededor del tablero
- Cuando una ficha da la vuelta completa, entra al **home stretch** de su color
- Dentro del home stretch, si el dado excede la distancia a meta → **no puede mover esa ficha** (no se puede pasar de largo)

## Capturas
- Si tu ficha cae en una casilla ocupada por un oponente → **captura**: el oponente vuelve a su base
- **Safe squares** (casillas seguras): [0, 8, 13, 21, 26, 34, 39, 47] — NO se puede capturar aquí
- Al capturar, el capturador gana una **tirada extra**
- En modo **Equipos 2v2** (Rojo+Amarillo vs Verde+Azul) NO se captura al compañero

## Home Stretch (Corredor Final)
- Cada color tiene su propio corredor de 5 casillas
- Solo las fichas de ese color pueden entrar
- Posiciones 52, 53, 54, 55, 56 (meta)
- Para llegar a meta, el dado debe dar exactamente la distancia necesaria

## Victoria
- El primer jugador en llevar sus **4 fichas a la posición 56** (meta) gana
- Se muestra pantalla de celebración con confetti 🎉

## Notas para Testing
- El dado es **100% aleatorio** (Math.random), sin manipulación
- Los bots tienen delay natural (1.2-2 segundos) para simular "pensar"
- Los stickers y mensajes son decorativos, no afectan el juego
- El chat muestra mensajes del sistema y reacciones de jugadores
- La barra superior muestra: emoji, nombre, fichas en casa 🏠, fichas en tablero 🎮, fichas en meta 🏁
