/** Shared animation timing for piece movement (used by the board renderer
 *  AND the store, which schedules effect reveals to match the travel). */

/** Seconds per cell for a piece's forward cell-by-cell travel. */
export const STEP_DURATION = 0.17;

/** Seconds per cell for a CAPTURED piece's fast backward run around the
 *  board to its base (Ludo Club style) — much quicker than a normal move
 *  since it can cover up to ~50 cells. */
export const RETURN_STEP_DURATION = 0.05;
