/**
 * Reaction payload helpers. The old emoji/vector sticker registry is gone:
 * the ONLY sendable reactions are memes the user PURCHASED in the
 * inventory, each paired with a sound.
 */

/* ─── Owned-meme reactions (inventory purchases) ───────────────────── */

/** Payload for a PURCHASED meme: `meme:<soundId>|<url>`. The sound id is
 *  resolved at SEND time (linked sound, or a deterministic fallback) so
 *  every client plays the same thing. Users can only send memes they own —
 *  the free sticker/sound pickers are gone. */
export const MEME_PREFIX = 'meme:';

export function isMemeReaction(value: string): boolean {
  return value.startsWith(MEME_PREFIX) && value.includes('|');
}

export function memePayload(soundId: string, url: string): string {
  return `${MEME_PREFIX}${soundId}|${url}`;
}

export function memePartsOf(value: string): { sound: string; url: string } {
  const rest = value.slice(MEME_PREFIX.length);
  const i = rest.indexOf('|');
  return { sound: i < 0 ? '' : rest.slice(0, i), url: rest.slice(i + 1) };
}
