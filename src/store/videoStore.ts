import { create } from 'zustand';
import type { Color } from '../game/types';

/**
 * Shares video-chat streams with the game UI so each player's camera renders
 * INSIDE their avatar circle on the board (replacing the emoji).
 */
interface VideoStore {
  /** Active media stream per player color (local + remote). */
  streams: Partial<Record<Color, MediaStream>>;
  /** Which color belongs to the local camera (mirrored + muted playback). */
  localColor: Color | null;
  cameraOn: boolean;
  micOn: boolean;

  setLocal: (color: Color | null, stream: MediaStream | null) => void;
  setRemote: (color: Color, stream: MediaStream | null) => void;
  setCameraOn: (on: boolean) => void;
  setMicOn: (on: boolean) => void;
  clearAll: () => void;
}

export const useVideoStore = create<VideoStore>((set, get) => ({
  streams: {},
  localColor: null,
  cameraOn: true,
  micOn: true,

  setLocal: (color, stream) => {
    const { streams, localColor } = get();
    const next = { ...streams };
    if (localColor && localColor !== color) delete next[localColor];
    if (color) {
      if (stream) next[color] = stream;
      else delete next[color];
    }
    set({ streams: next, localColor: stream ? color : null });
  },

  setRemote: (color, stream) => {
    const next = { ...get().streams };
    if (stream) next[color] = stream;
    else delete next[color];
    set({ streams: next });
  },

  setCameraOn: (on) => set({ cameraOn: on }),
  setMicOn: (on) => set({ micOn: on }),

  clearAll: () => set({ streams: {}, localColor: null, cameraOn: true, micOn: true }),
}));
