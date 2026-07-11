declare module 'canvas-confetti' {
  interface Options {
    particleCount?: number;
    angle?: number;
    spread?: number;
    startVelocity?: number;
    decay?: number;
    gravity?: number;
    drift?: number;
    ticks?: number;
    origin?: { x?: number; y?: number };
    colors?: string[];
    shapes?: string[];
    scalar?: number;
    zIndex?: number;
    disableForReducedMotion?: boolean;
  }

  type CreateTypes = (options?: Options) => Promise<null> | null;

  function confetti(options?: Options): Promise<null> | null;
  function confetti(create?: CreateTypes): Promise<null> | null;

  export default confetti;
}

declare module 'canvas-confetti' {
  export function reset(): void;
  export function create(options?: Options): (() => Promise<null> | null) | null;
}
