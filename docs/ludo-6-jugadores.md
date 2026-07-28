# Análisis: Ludo de 6 jugadores (tablero hexagonal)

## Veredicto: VIABLE, pero es el trabajo más grande del backlog (~1 semana dev)

## Qué cambia
- **Tablero**: no sirve la cuadrícula 15×15. El estándar de 6 jugadores usa
  una estrella/hexágono con 6 brazos: anillo de **78 casillas** (13 por
  sector), 6 salidas, 6 pasillos finales de 5 + meta central hexagonal.
- **Geometría**: coordenadas polares/hex en vez de grid CSS → nuevo
  `boardPath6.ts` (78 posiciones x,y en %), render SVG del tablero
  (más simple que grid para formas hexagonales) y `boardRotation6`
  (rotaciones de 60°, no de 90°).
- **Motor**: parametrizar `RING_LEN` (52→78), `HOME_STRETCH_ENTRY` (6
  entradas), `COLORS` (+ púrpura y naranja), `PLAYER_COLORS_ORDER`
  horario de 6, casillas seguras (12). El motor actual ya es
  data-driven en un 80% — el resto son constantes hardcodeadas a 4.
- **UI**: 6 avatares (3 arriba/3 abajo), seating online de 6, equipos
  2v2v2 o 3v3 opcionales.

## Plan por fases (cuando lo aprueben)
1. `boardPath6.ts` + render SVG del tablero hex (2 días)
2. Motor parametrizado por `RingConfig {len, entries, safes}` (1 día)
3. Lobby/online para 6 asientos + rotación 60° (1 día)
4. Bots, timer, apuestas, memes ya funcionan sin cambios (validar) (1 día)

## Recomendación
Lanzar primero "Piezas Hermanas" (ya implementado) y validar tracción;
el tablero de 6 justifica su semana solo con base de jugadores activa.
