# Ludo hexagonal de 6 jugadores — DISEÑO (Fase 1 implementada)

## Estado
- ✅ **Fase 1 (geometría + tablero)**: implementada en
  `src/game/hex/boardPath6.ts` + `src/components/BoardHex.tsx`.
  **Pruébalo en producción**: `https://<tu-dominio>/?hexpreview`
  (añade `&idx` para ver el índice de cada casilla).
- ⏳ Fase 2 (motor), Fase 3 (lobby/online), Fase 4 (validación) — abajo.

## Geometría (fuente de verdad: `boardPath6.ts`)
- Estrella de 6 brazos a 60°, todo en coordenadas polares → % del tablero
  (sin grid CSS). El SVG del tablero y la capa de fichas comparten las
  mismas coordenadas vía `hexPiecePosition()` (mismo patrón que el 4p).
- **Anillo: 78 casillas** (13 por brazo), sentido horario. Patrón por
  brazo k: 6 de subida (columna izquierda) + 1 punta (entrada al pasillo
  del dueño del brazo) + 6 de bajada (columna derecha).
- **Colores (6)**: rojo, azul, amarillo, verde, **morado**, **celeste**
  (`HexColor`). El color k es dueño del brazo k; su base vive en la cuña
  horaria de su brazo.
- **Salida**: `HEX_ENTRY[c] = 13k + 8` (columna de bajada, pegada a la
  base). **Entrada al pasillo**: `13k + 6` (la punta del propio brazo).
  Recorrido: **76 casillas de anillo + 5 de pasillo + meta = 82 pasos**
  (vs 56 del tablero de 4 → partidas ~45% más largas, estándar en 6p).
- **Codificación de posición**: `-1` base · `0..77` anillo ·
  `78..82` pasillo propio · `83` meta (`HEX_GOAL`).
- **Seguras (12)**: `13k+1` y `13k+8` de cada brazo (2 por sector,
  equivalente a las 8 del tablero de 4).
- Helpers listos para el motor: `hexNextLogical`, `hexCalculateNewPosition`
  (con detección de pasarse de la meta), `hexIsSafe`, `hexLane`,
  `hexBase`, `hexCenter`.

## Reglas (idénticas al 4p salvo escala)
- 6/1 sacan de base y dan tiro extra; matar/meta dan tiro extra
  (6+kill = doble); 3 extras seguidos cancelan; 20s por turno.
- Capturas: igual (segura = intocable, grupos = bloqueo).
- **Equipos**: 2v2v2 (3 equipos de 2, colores opuestos: rojo+verde,
  azul+morado, amarillo+celeste) o 3v3 (alternos). Propuesta inicial:
  solo 2v2v2, opuestos a 180°.
- Piezas Hermanas, apuestas, memes, dados de la suerte: sin cambios
  (son independientes de la geometría).

## Fase 2 — Motor parametrizado (~1-2 días)
- Introducir `RingConfig { len, laneStart, goal, entries, laneEntrances,
  safes, order }` y pasar el config a `gameEngine` (movePiece,
  calculateNewPosition, canPieceMove, checkWin, advanceTurn).
- `Color` pasa a incluir 'purple' | 'cyan' (COLOR_CONFIG + PLAYER_CONFIG
  + PawnSVG + Piece.css con los dos gradientes nuevos).
- `GameMode` nuevo: `'hex6'` (elige tablero + config de 6).

## Fase 3 — UI/online (~1-2 días)
- `BoardHex` gana capa de fichas (reutiliza `Piece` con anchors %).
- Rotación de perspectiva: 60° por asiento (`k = arm(mi color)`),
  rotando el SVG completo + contra-rotando fichas.
- Lobby de 6 asientos (grid 3×2) + `ONLINE_SEAT_ORDER` de 6 (diagonales
  primero). Avatares en juego: 3 arriba / 3 abajo.
- Bots: `chooseBotMove` ya es genérico si recibe el RingConfig.

## Fase 4 — Validación (~1 día)
- Suite de recorrido (entrada → 82 pasos → meta exacta) por color.
- Partida completa de 6 bots automatizada (Puppeteer).
- Timer, apuestas (pozo de hasta 6 entradas), memes y ranking en 6p.

## Decisiones abiertas (para el dueño del producto)
1. ¿2v2v2, 3v3, o ambos como toggle?
2. ¿El modo 6p exige mínimo 2 humanos online, o vale 1 humano + 5 bots?
3. ¿Apuesta máxima igual (3.000) o más alta en mesas de 6?
