import type { MediaConnection } from 'peerjs';
import type { Color } from '../game/types';
import { useGameStore } from '../store/gameStore';
import { useVideoStore } from '../store/videoStore';
import { getMyPeerId, setAvSubscriber, callPeer, type RosterEntry } from './onlineManager';

/**
 * Camera/mic mesh over the SAME PeerJS room onlineManager already
 * maintains — every participant (host + guests) calls every OTHER
 * participant directly once they enable their camera/mic, so everyone can
 * see and hear everyone else. No separate "video room" or manual code.
 *
 * Rule: whoever activates local media (now, or later) dials every peer
 * currently in the roster with their stream. The other side always
 * answers (with their own stream if they have one, or none yet) so
 * incoming video/audio is visible even before the answerer activates
 * their own camera.
 */

let localStream: MediaStream | null = null;
let roster: RosterEntry[] = [];
const calls = new Map<string, MediaConnection>(); // peerId -> active call (either direction)
const calledPeers = new Set<string>(); // peerIds already dialed with the CURRENT localStream

const analysers = new Map<Color, AnalyserNode>();
let audioCtx: AudioContext | null = null;
let speakingRaf: number | null = null;

function colorForPlayerId(playerId: string): Color | null {
  const player = useGameStore.getState().players.find((p) => p.id === playerId);
  return player ? player.color : null;
}

function colorForPeer(peerId: string): Color | null {
  const entry = roster.find((r) => r.peerId === peerId);
  return entry ? colorForPlayerId(entry.playerId) : null;
}

function myColor(): Color | null {
  const localId = useGameStore.getState().localPlayerId;
  return localId ? colorForPlayerId(localId) : null;
}

/* ─── Speaking detection (WebAudio level meter per remote stream) ──── */

function setupSpeaking(color: Color, stream: MediaStream) {
  if (stream.getAudioTracks().length === 0) return;
  try {
    audioCtx ??= new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analysers.set(color, analyser);
    if (speakingRaf === null) tickSpeaking();
  } catch {
    /* WebAudio unavailable — skip the speaking indicator */
  }
}

function tickSpeaking() {
  const data = new Uint8Array(128);
  for (const [color, analyser] of analysers) {
    analyser.getByteFrequencyData(data as Uint8Array<ArrayBuffer>);
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i];
    useVideoStore.getState().setSpeaking(color, sum / data.length > 8);
  }
  speakingRaf = analysers.size > 0 ? requestAnimationFrame(tickSpeaking) : null;
}

function stopSpeaking() {
  if (speakingRaf !== null) { cancelAnimationFrame(speakingRaf); speakingRaf = null; }
  analysers.clear();
  if (audioCtx) { try { void audioCtx.close(); } catch { /* noop */ } audioCtx = null; }
}

/* ─── Call wiring ───────────────────────────────────────────────────── */

function attachCall(peerId: string, call: MediaConnection) {
  calls.set(peerId, call);
  call.on('stream', (remoteStream) => {
    const color = colorForPeer(peerId);
    if (!color) return;
    useVideoStore.getState().setRemote(color, remoteStream);
    setupSpeaking(color, remoteStream);
  });
  const cleanup = () => {
    calls.delete(peerId);
    calledPeers.delete(peerId);
    const color = colorForPeer(peerId);
    if (color) {
      useVideoStore.getState().setRemote(color, null);
      useVideoStore.getState().setSpeaking(color, false);
      analysers.delete(color);
    }
  };
  call.on('close', cleanup);
  call.on('error', cleanup);
}

function callAllRosterPeers() {
  if (!localStream) return;
  const myId = getMyPeerId();
  for (const entry of roster) {
    if (entry.peerId === myId || calledPeers.has(entry.peerId)) continue;
    const call = callPeer(entry.peerId, localStream);
    if (call) {
      calledPeers.add(entry.peerId);
      attachCall(entry.peerId, call);
    }
  }
}

function handleIncomingCall(peerId: string, call: MediaConnection) {
  // Answer with our stream if we have one; otherwise receive-only (we'll
  // still see/hear THEM even before we activate our own camera/mic).
  call.answer(localStream ?? undefined);
  attachCall(peerId, call);
}

function handleRosterChange(newRoster: RosterEntry[]) {
  roster = newRoster;
  if (localStream) callAllRosterPeers();
  // Drop calls for participants who left the roster
  const activeIds = new Set(newRoster.map((r) => r.peerId));
  for (const [peerId, call] of calls) {
    if (!activeIds.has(peerId)) {
      try { call.close(); } catch { /* noop */ }
    }
  }
}

/* ─── Local media ────────────────────────────────────────────────────── */

async function ensureLocalStream(): Promise<MediaStream | null> {
  if (localStream) return localStream;
  const color = myColor();

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' },
      audio: true,
    });
    localStream = stream;
    calledPeers.clear();
    if (color) {
      useVideoStore.getState().setLocal(color, stream);
      useVideoStore.getState().setCameraOn(true);
      useVideoStore.getState().setMicOn(true);
    }
    return stream;
  } catch {
    // Camera denied/unavailable — fall back to audio-only so voice chat
    // still works even without a camera.
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStream = audioStream;
      calledPeers.clear();
      if (color) {
        useVideoStore.getState().setLocal(color, audioStream);
        useVideoStore.getState().setCameraOn(false);
        useVideoStore.getState().setMicOn(true);
      }
      return audioStream;
    } catch {
      return null;
    }
  }
}

async function toggleCamera() {
  const stream = await ensureLocalStream();
  if (!stream) return;
  const track = stream.getVideoTracks()[0];
  if (track) {
    track.enabled = !track.enabled;
    useVideoStore.getState().setCameraOn(track.enabled);
  }
  callAllRosterPeers();
}

async function toggleMic() {
  const stream = await ensureLocalStream();
  if (!stream) return;
  const track = stream.getAudioTracks()[0];
  if (track) {
    track.enabled = !track.enabled;
    useVideoStore.getState().setMicOn(track.enabled);
  }
  callAllRosterPeers();
}

/* ─── Session lifecycle ─────────────────────────────────────────────── */

/** Start the AV session for the current online room (host or guest). */
export function startAvSession() {
  useVideoStore.getState().setControls({ toggleCamera, toggleMic });
  setAvSubscriber({ onRoster: handleRosterChange, onCall: handleIncomingCall });
}

/** Tear down all calls, local media, and AV state when leaving the room. */
export function stopAvSession() {
  setAvSubscriber(null);
  stopSpeaking();
  for (const call of calls.values()) {
    try { call.close(); } catch { /* noop */ }
  }
  calls.clear();
  calledPeers.clear();
  roster = [];
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }
  useVideoStore.getState().clearAll();
}
