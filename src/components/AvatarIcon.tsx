import type { LucideIcon } from 'lucide-react';
import {
  Bird, Cat, Cloud, Crown, Dices, Dog, Fish, Flame, Gamepad2, Ghost,
  Rabbit, Rocket, Skull, Squirrel, Star, Sun, Turtle, Zap,
} from 'lucide-react';

/**
 * Professional vector avatars (lucide icons) — replaces the old emoji
 * avatar set. `Player.emoji` now stores one of these KEYS; legacy emoji
 * characters (old profiles / mid-rollout peers) map to the closest icon.
 */

export const AVATAR_KEYS = [
  'dice', 'rocket', 'crown', 'ghost', 'cat', 'dog', 'bird', 'fish',
  'rabbit', 'turtle', 'squirrel', 'skull', 'star', 'zap', 'flame', 'gamepad',
] as const;

const REGISTRY: Record<string, LucideIcon> = {
  dice: Dices,
  rocket: Rocket,
  crown: Crown,
  ghost: Ghost,
  cat: Cat,
  dog: Dog,
  bird: Bird,
  fish: Fish,
  rabbit: Rabbit,
  turtle: Turtle,
  squirrel: Squirrel,
  skull: Skull,
  star: Star,
  zap: Zap,
  flame: Flame,
  gamepad: Gamepad2,
  sun: Sun,
  cloud: Cloud,
};

/** Old emoji avatars → icon keys (kept so stored profiles keep working). */
const LEGACY: Record<string, string> = {
  '🎲': 'dice', '🏃‍♂️': 'zap', '🦊': 'cat', '🐸': 'turtle', '🐱': 'cat',
  '🦄': 'star', '🐝': 'bird', '🎭': 'ghost', '👑': 'crown', '🤖': 'gamepad',
  '👽': 'ghost', '🐉': 'flame', '🦁': 'cat', '🦅': 'bird', '🐹': 'squirrel',
  '🐧': 'bird', '🦖': 'flame', '🥝': 'turtle', '🌞': 'sun', '☁️': 'cloud',
};

export default function AvatarIcon({ id, size = 24, strokeWidth = 2.4 }: {
  id: string;
  size?: number;
  strokeWidth?: number;
}) {
  const Icon = REGISTRY[id] ?? REGISTRY[LEGACY[id] ?? ''] ?? Dices;
  return <Icon size={size} strokeWidth={strokeWidth} aria-hidden />;
}
