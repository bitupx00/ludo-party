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
 *
 * Reliability rules learned the hard way:
 * - A call may be REPLACED (e.g. a receive-only call is superseded when
 *   the answerer finally enables their camera and dials back). The old
 *   call's close event must NOT wipe the new call's stream — every
 *   cleanup checks it still owns the `calls` slot.
 * - Outgoing calls that never deliver a remote stream are closed and
 *   redialed (bounded), instead of silently staying black forever.
 * - Self-entries in the roster are recognized by playerId (stable), not
 *   peerId — after a reconnect our own STALE peer id may still be listed
 *   and must not be dialed.
 */

let localStream: MediaStream | null = null;
let roster: RosterEntry[] = [];
const calls = new Map<string, MediaConnection>(); // peerId -> active call (either direction)
const calledPeers = new Set<string>(); // peerIds already dialed with the CURRENT localStream
const callAttempts = new Map<string, number>(); // peerId -> stream-less dial failures

/** Max redials to a peer whose calls never deliver a stream. */
const MAX_CALL_ATTEMPTS = 3;
/** How long an outgoing call may stay stream-less before we redial. */
const CALL_STREAM_TIMEOUT_MS = 7000;

const analysers = new Map<Color, AnalyserNode>();
let audioCtx: AudioContext | null = null;
let speakingTimer: ReturnType<typeof setInterval> | null = null;
/** Shared FFT read buffer — allocated once, not per tick. */
const speakingBuf = new Uint8Array(128);
/** Voice-activity polling rate. The old requestAnimationFrame loop ran
 *  this at 60fps for the WHOLE online session (allocating a buffer per
 *  frame) — a constant CPU drain on phones. ~8Hz is plenty for a
 *  speaking indicator. */
const SPEAKING_POLL_MS = 120;

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
    // Autoplay policy may start the context suspended — resumed by the
    // gesture listener installed in startAvSession.
    if (audioCtx.state === 'suspended') { void audioCtx.resume().catch(() => {}); }
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analysers.set(color, analyser);
    if (speakingTimer === null) speakingTimer = setInterval(tickSpeaking, SPEAKING_POLL_MS);
  } catch {
    /* WebAudio unavailable — skip the speaking indicator */
  }
}

function tickSpeaking() {
  if (analysers.size === 0) {
    if (speakingTimer !== null) { clearInterval(speakingTimer); speakingTimer = null; }
    return;
  }
  for (const [color, analyser] of analysers) {
    analyser.getByteFrequencyData(speakingBuf as Uint8Array<ArrayBuffer>);
    let sum = 0;
    for (let i = 0; i < speakingBuf.length; i++) sum += speakingBuf[i];
    useVideoStore.getState().setSpeaking(color, sum / speakingBuf.length > 8);
  }
}

function stopSpeaking() {
  if (speakingTimer !== null) { clearInterval(speakingTimer); speakingTimer = null; }
  analysers.clear();
  if (audioCtx) { try { void audioCtx.close(); } catch { /* noop */ } audioCtx = null; }
}

/** Browsers may keep WebAudio/media playback suspended until a user
 *  gesture — resume on the first interaction after AV starts. */
function resumeOnGesture() {
  if (audioCtx && audioCtx.state === 'suspended') {
    void audioCtx.resume().catch(() => {});
  }
}

/* ─── Call wiring ───────────────────────────────────────────────────── */

function attachCall(peerId: string, call: MediaConnection, outgoing: boolean) {
  // Replace (and close) any previous call to this peer. The guard in
  // cleanup below keeps the old call's close event from touching us.
  const prev = calls.get(peerId);
  calls.set(peerId, call);
  if (prev && prev !== call) {
    try { prev.close(); } catch { /* noop */ }
  }

  let gotStream = false;

  call.on('stream', (remoteStream) => {
    if (calls.get(peerId) !== call) return; // superseded while connecting
    gotStream = true;
    callAttempts.delete(peerId);
    const color = colorForPeer(peerId);
    if (!color) return;
    useVideoStore.getState().setRemote(color, remoteStream);
    setupSpeaking(color, remoteStream);
  });

  const cleanup = () => {
    if (calls.get(peerId) !== call) return; // a newer call owns this slot now
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

  if (outgoing) {
    // Watchdog: a dial that never yields a remote stream would otherwise
    // sit black forever. Close it and redial (bounded per peer).
    setTimeout(() => {
      if (gotStream || calls.get(peerId) !== call) return;
      const attempts = (callAttempts.get(peerId) ?? 0) + 1;
      callAttempts.set(peerId, attempts);
      calls.delete(peerId); // release the slot BEFORE close so cleanup no-ops
      calledPeers.delete(peerId);
      try { call.close(); } catch { /* noop */ }
      if (attempts < MAX_CALL_ATTEMPTS) callAllRosterPeers();
    }, CALL_STREAM_TIMEOUT_MS);
  }
}

function callAllRosterPeers() {
  if (!localStream) return;
  const myPeerId = getMyPeerId();
  const myLocalId = useGameStore.getState().localPlayerId;
  for (const entry of roster) {
    // Identify ourselves by playerId too: after a reconnect the roster may
    // briefly still contain our OWN old peer id — dialing it would fail.
    if (entry.peerId === myPeerId || entry.playerId === myLocalId) continue;
    if (calledPeers.has(entry.peerId)) continue;
    if ((callAttempts.get(entry.peerId) ?? 0) >= MAX_CALL_ATTEMPTS) continue;
    const call = callPeer(entry.peerId, localStream);
    if (call) {
      calledPeers.add(entry.peerId);
      attachCall(entry.peerId, call, true);
    }
  }
}

function handleIncomingCall(peerId: string, call: MediaConnection) {
  // Answer with our stream if we have one; otherwise receive-only (we'll
  // still see/hear THEM even before we activate our own camera/mic).
  call.answer(localStream ?? undefined);
  attachCall(peerId, call, false);
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

/** The data session was rebuilt (guest reconnect): all media calls died
 *  with it. Drop everything and let the fresh roster re-dial the mesh. */
function handleSessionReset() {
  for (const call of calls.values()) {
    try { call.close(); } catch { /* noop */ }
  }
  calls.clear();
  calledPeers.clear();
  callAttempts.clear();
  if (localStream) callAllRosterPeers();
}

/* ─── Health monitor: self-healing mesh ─────────────────────────────── */
// Field failure mode: mid-game every camera goes black and all audio dies
// at once (ICE failure after a network change, device sleep, etc.) and
// NEVER comes back — WebRTC often reaches 'failed'/'disconnected' without
// firing close events, and the old bounded-retry gave up permanently.
// This loop watches every call's underlying RTCPeerConnection and rebuilds
// dead links; retry budgets refill periodically so recovery keeps trying.

let healthTimer: ReturnType<typeof setInterval> | null = null;
const shakyTicks = new Map<string, number>(); // peerId -> consecutive 'disconnected' ticks
let ticksSinceBudgetRefill = 0;

const HEALTH_INTERVAL_MS = 4000;
/** 'disconnected' can self-heal in seconds; only rebuild after 2 ticks (~8s). */
const SHAKY_TICKS_BEFORE_REBUILD = 2;
/** Refill the per-peer dial budget every ~32s so retries never stop for good. */
const TICKS_PER_BUDGET_REFILL = 8;

function dropAndRedial(peerId: string) {
  const call = calls.get(peerId);
  calls.delete(peerId); // release the slot first so cleanup handlers no-op
  calledPeers.delete(peerId);
  shakyTicks.delete(peerId);
  if (call) { try { call.close(); } catch { /* noop */ } }
  const color = colorForPeer(peerId);
  if (color) {
    useVideoStore.getState().setRemote(color, null);
    useVideoStore.getState().setSpeaking(color, false);
    analysers.delete(color);
  }
  callAllRosterPeers();
}

function healthCheck() {
  ticksSinceBudgetRefill++;
  if (ticksSinceBudgetRefill >= TICKS_PER_BUDGET_REFILL) {
    ticksSinceBudgetRefill = 0;
    callAttempts.clear(); // never give up permanently
    if (localStream) callAllRosterPeers(); // pick up any peers we'd abandoned
  }

  // Keep the WebAudio meter alive (mobile browsers suspend it on blur)
  if (audioCtx && audioCtx.state === 'suspended') {
    void audioCtx.resume().catch(() => {});
  }

  for (const [peerId, call] of calls) {
    const pc = (call as unknown as { peerConnection?: RTCPeerConnection }).peerConnection;
    if (!pc) continue;
    const state = pc.connectionState;
    const ice = pc.iceConnectionState;
    if (state === 'failed' || state === 'closed' || ice === 'failed' || ice === 'closed') {
      dropAndRedial(peerId);
      continue;
    }
    if (state === 'disconnected' || ice === 'disconnected') {
      const ticks = (shakyTicks.get(peerId) ?? 0) + 1;
      shakyTicks.set(peerId, ticks);
      if (ticks >= SHAKY_TICKS_BEFORE_REBUILD) dropAndRedial(peerId);
    } else {
      shakyTicks.delete(peerId);
    }
  }
}

/** Coming back from background (mobile tab switch/screen off) is a classic
 *  moment for the mesh to be silently dead — check immediately. */
function onVisibilityChange() {
  if (document.visibilityState === 'visible') {
    healthCheck();
    if (localStream) callAllRosterPeers();
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
    callAttempts.clear();
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
      callAttempts.clear();
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
  // First tap ACQUIRES the media (tracks start enabled) — only later taps
  // toggle. Toggling on the acquiring tap turned the camera off the
  // instant it went on, so others received a black feed.
  const hadStream = !!localStream;
  const stream = await ensureLocalStream();
  if (!stream) return;
  if (hadStream) {
    const track = stream.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      useVideoStore.getState().setCameraOn(track.enabled);
    }
  }
  callAllRosterPeers();
}

async function toggleMic() {
  const hadStream = !!localStream;
  const stream = await ensureLocalStream();
  if (!stream) return;
  if (hadStream) {
    const track = stream.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      useVideoStore.getState().setMicOn(track.enabled);
    }
  }
  callAllRosterPeers();
}

/* ─── Session lifecycle ─────────────────────────────────────────────── */

/** Start the AV session for the current online room (host or guest). */
export function startAvSession() {
  useVideoStore.getState().setControls({ toggleCamera, toggleMic });
  setAvSubscriber({
    onRoster: handleRosterChange,
    onCall: handleIncomingCall,
    onReset: handleSessionReset,
  });
  document.addEventListener('pointerdown', resumeOnGesture);
  document.addEventListener('visibilitychange', onVisibilityChange);
  if (healthTimer) clearInterval(healthTimer);
  healthTimer = setInterval(healthCheck, HEALTH_INTERVAL_MS);
}

/** Tear down all calls, local media, and AV state when leaving the room. */
export function stopAvSession() {
  document.removeEventListener('pointerdown', resumeOnGesture);
  document.removeEventListener('visibilitychange', onVisibilityChange);
  if (healthTimer) { clearInterval(healthTimer); healthTimer = null; }
  shakyTicks.clear();
  setAvSubscriber(null);
  stopSpeaking();
  for (const call of calls.values()) {
    try { call.close(); } catch { /* noop */ }
  }
  calls.clear();
  calledPeers.clear();
  callAttempts.clear();
  roster = [];
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }
  useVideoStore.getState().clearAll();
}
