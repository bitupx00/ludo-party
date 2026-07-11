import Peer, { type DataConnection, type MediaConnection, type PeerOptions } from 'peerjs';
import type { Color } from '../game/types';
import { useGameStore, SNAPSHOT_KEYS, type GameSnapshot } from '../store/gameStore';
import { loadProfile } from '../profile';

/**
 * Online multiplayer over PeerJS (WebRTC data channels), host-authoritative:
 * the host runs the game engine (and the bots); guests send their inputs and
 * mirror the host's state snapshots. No game server needed.
 *
 * This module ALSO owns the room's single PeerJS connection graph, which the
 * AV layer (src/online/avManager.ts) reuses for camera/mic mesh calls —
 * camera/mic must never spin up a second, disconnected PeerJS room.
 *
 * Resilience:
 * - Guests keep a "seat ticket" (roomCode + playerId + secret token) in
 *   localStorage. If their connection drops (network blip, page reload,
 *   app killed), rejoining the same room from the same device reclaims
 *   their exact seat — the host validates the token and flips the seat
 *   back from bot to human.
 * - App-level ping/pong heartbeat detects dead connections fast on both
 *   sides (WebRTC close events can take minutes on mobile networks).
 * - Guests auto-reconnect in the background (with a "reconnecting" UI
 *   state) before giving up and reporting the host as gone.
 * - Joining retries transient 'peer-unavailable' broker errors a few
 *   times before reporting "room not found".
 */

/* ─── Protocol ────────────────────────────────────────────────────── */

export type GuestAction =
  | { a: 'roll'; lucky?: number } // lucky = bought lucky-dice number (host validates the cost)
  | { a: 'select'; pieceId: string }
  | { a: 'seat'; color: Color } // lobby color pick (host validates it's free)
  | { a: 'reaction'; emoji: string }
  | { a: 'chat'; text: string };

type GuestMessage =
  | { t: 'join'; name: string; points?: number; rejoin?: { playerId: string; token: string } }
  | { t: 'pong' }
  | ({ t: 'action' } & GuestAction);

/** peerId ↔ playerId pairing for every participant, used to set up AV mesh calls. */
export interface RosterEntry {
  peerId: string;
  playerId: string;
}

type HostMessage =
  | { t: 'welcome'; playerId: string; token: string }
  | { t: 'full'; snap: GameSnapshot }
  | { t: 'peers'; list: RosterEntry[] }
  | { t: 'ping' }
  | { t: 'error'; code: 'room-full' | 'in-game' }
  | { t: 'bye' };

const ROOM_PREFIX = 'ludo-party-room-';

/* ─── Tuning ───────────────────────────────────────────────────────── */

const JOIN_TIMEOUT_MS = 20000;
/** Connect attempts before reporting "room not found" (broker errors are often transient). */
const JOIN_CONNECT_ATTEMPTS = 3;
const JOIN_RETRY_DELAY_MS = 1600;
/** Heartbeat: host pings every 5s; either side treats >14s of silence as a dead link. */
const PING_INTERVAL_MS = 5000;
const STALE_LINK_MS = 14000;
/** Guest auto-reconnect: attempts spaced 2.5s apart before giving up. */
const RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 2500;

/* ─── Seat ticket (device-bound rejoin credential) ─────────────────── */

const TICKET_KEY = 'ludo-party-ticket';
const TICKET_TTL_MS = 12 * 3600 * 1000;

interface SeatTicket {
  code: string;
  name: string;
  playerId: string;
  token: string;
  ts: number;
}

function storeTicket(t: SeatTicket) {
  try { localStorage.setItem(TICKET_KEY, JSON.stringify(t)); } catch { /* noop */ }
}

function readTicket(): SeatTicket | null {
  try {
    const raw = localStorage.getItem(TICKET_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as SeatTicket;
    if (!t.code || !t.playerId || !t.token || Date.now() - (t.ts ?? 0) > TICKET_TTL_MS) return null;
    return t;
  } catch {
    return null;
  }
}

export function clearStoredTicket() {
  try { localStorage.removeItem(TICKET_KEY); } catch { /* noop */ }
}

/** Room the device can offer to rejoin (shown as a shortcut in the lobby). */
export function getStoredTicket(): { code: string; name: string } | null {
  const t = readTicket();
  return t ? { code: t.code, name: t.name } : null;
}

/* ─── Peer configuration (local override for dev/testing) ─────────── */

function peerOptions(): PeerOptions {
  const host = import.meta.env.VITE_PEER_HOST as string | undefined;
  if (host) {
    return {
      host,
      port: Number(import.meta.env.VITE_PEER_PORT ?? 9000),
      path: (import.meta.env.VITE_PEER_PATH as string | undefined) ?? '/',
      secure: false,
    };
  }
  return {}; // PeerJS public cloud broker
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/* ─── Session state (module-level, outside React) ─────────────────── */

let peer: Peer | null = null;
let hostConn: DataConnection | null = null; // guest → host link
const guestConns = new Map<string, { conn: DataConnection; playerId: string | null; lastPong: number }>();
const seatTokens = new Map<string, string>(); // host: playerId → rejoin token
let unsubscribeStore: (() => void) | null = null;
let lastBroadcast = '';
let leftVoluntarily = false;
let myPlayerId: string | null = null;
let lastRoster: RosterEntry[] = [];

let pingTimer: ReturnType<typeof setInterval> | null = null; // host heartbeat
let guestWatchTimer: ReturnType<typeof setInterval> | null = null; // guest staleness watchdog
let lastPingFromHost = 0;
let reconnecting = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectInfo: { code: string; name: string } | null = null; // set on successful join

/** AV layer hooks (src/online/avManager.ts subscribes here). */
interface AvSubscriber {
  onRoster: (roster: RosterEntry[]) => void;
  onCall: (peerId: string, call: MediaConnection) => void;
  /** Connection was rebuilt (guest reconnect) — drop stale media calls and re-dial. */
  onReset: () => void;
}
let avSubscriber: AvSubscriber | null = null;

export function setAvSubscriber(sub: AvSubscriber | null) {
  avSubscriber = sub;
  // The roster may have arrived BEFORE the AV layer subscribed (join
  // handshake races the store's startAvSession call) — deliver the cached
  // one immediately so the mesh never starts from a silently-empty roster.
  if (sub && lastRoster.length > 0) sub.onRoster(lastRoster);
}

/** This device's own PeerJS id (stable for the life of the room). */
export function getMyPeerId(): string | null {
  return peer ? peer.id : null;
}

/** Place a media call to another participant in the room (mesh AV). */
export function callPeer(peerId: string, stream: MediaStream): MediaConnection | null {
  return peer ? peer.call(peerId, stream) : null;
}

/** Tell onlineManager which player THIS device controls, for roster broadcasts. */
export function setMyPlayerId(id: string) {
  myPlayerId = id;
  if (guestConns.size > 0) broadcastRoster();
}

function stopTimers() {
  if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
  if (guestWatchTimer) { clearInterval(guestWatchTimer); guestWatchTimer = null; }
}

function destroySession() {
  stopTimers();
  if (unsubscribeStore) { unsubscribeStore(); unsubscribeStore = null; }
  for (const { conn } of guestConns.values()) {
    try { conn.close(); } catch { /* noop */ }
  }
  guestConns.clear();
  if (hostConn) { try { hostConn.close(); } catch { /* noop */ } hostConn = null; }
  if (peer) { try { peer.destroy(); } catch { /* noop */ } peer = null; }
  lastBroadcast = '';
  myPlayerId = null;
  lastRoster = [];
}

/* ─── Snapshots ────────────────────────────────────────────────────── */

function currentSnapshot(): GameSnapshot {
  const s = useGameStore.getState();
  const snap = {} as Record<string, unknown>;
  for (const key of SNAPSHOT_KEYS) snap[key] = s[key];
  return snap as unknown as GameSnapshot;
}

function broadcastState() {
  if (guestConns.size === 0) return;
  const snap = currentSnapshot();
  const encoded = JSON.stringify(snap);
  if (encoded === lastBroadcast) return;
  lastBroadcast = encoded;
  const msg: HostMessage = { t: 'full', snap };
  for (const { conn } of guestConns.values()) {
    if (conn.open) {
      try { conn.send(msg); } catch { /* peer gone; close event will clean up */ }
    }
  }
}

/** Host: the current peerId↔playerId roster (self + every seated guest). */
function currentRoster(): RosterEntry[] {
  const list: RosterEntry[] = [];
  if (myPlayerId && peer) list.push({ peerId: peer.id, playerId: myPlayerId });
  for (const [peerId, entry] of guestConns) {
    if (entry.playerId) list.push({ peerId, playerId: entry.playerId });
  }
  return list;
}

/** Host: push the roster to every guest and to this device's own AV layer. */
function broadcastRoster() {
  const roster = currentRoster();
  lastRoster = roster;
  avSubscriber?.onRoster(roster);
  const msg: HostMessage = { t: 'peers', list: roster };
  for (const { conn } of guestConns.values()) {
    if (conn.open) {
      try { conn.send(msg); } catch { /* noop */ }
    }
  }
}

/* ─── Host ─────────────────────────────────────────────────────────── */

/** Host: a guest link is gone — free the seat (or botify it mid-game). */
function dropGuest(peerId: string) {
  const entry = guestConns.get(peerId);
  if (!entry) return;
  guestConns.delete(peerId);
  try { entry.conn.close(); } catch { /* noop */ }
  if (entry.playerId) {
    useGameStore.getState().handleGuestLeft(entry.playerId);
    // Keep the seat token: the same device can still reclaim this seat.
  }
  broadcastRoster();
}

export function hostRoom(code: string): Promise<void> {
  leftVoluntarily = false;
  return new Promise((resolve, reject) => {
    const p = new Peer(`${ROOM_PREFIX}${code}`, peerOptions());
    peer = p;

    p.on('open', () => {
      // Broadcast every store change to connected guests (microtask-batched)
      let pending = false;
      unsubscribeStore = useGameStore.subscribe(() => {
        if (pending) return;
        pending = true;
        queueMicrotask(() => {
          pending = false;
          broadcastState();
        });
      });

      // Heartbeat: ping guests; drop links that stopped answering. WebRTC
      // 'close' can take minutes to fire on mobile networks — this keeps
      // seats from being stuck on dead connections.
      pingTimer = setInterval(() => {
        const now = Date.now();
        for (const [peerId, entry] of guestConns) {
          if (now - entry.lastPong > STALE_LINK_MS) {
            dropGuest(peerId);
            continue;
          }
          if (entry.conn.open) {
            try { entry.conn.send({ t: 'ping' } satisfies HostMessage); } catch { /* noop */ }
          }
        }
      }, PING_INTERVAL_MS);

      resolve();
    });

    p.on('connection', (conn) => {
      guestConns.set(conn.peer, { conn, playerId: null, lastPong: Date.now() });

      conn.on('data', (raw) => {
        const msg = raw as GuestMessage;
        const store = useGameStore.getState();
        const entry = guestConns.get(conn.peer);
        if (!entry) return;
        entry.lastPong = Date.now(); // any traffic proves the link is alive

        if (msg.t === 'pong') return;

        if (msg.t === 'join') {
          // Seat reclaim: a device that was here before presents its ticket.
          // Valid mid-game too — that's the whole point of reconnection.
          const rejoin = msg.rejoin;
          if (
            rejoin &&
            seatTokens.get(rejoin.playerId) === rejoin.token &&
            store.players.some((pl) => pl.id === rejoin.playerId)
          ) {
            // Drop any stale link still bound to this seat (old connection
            // that hasn't timed out yet) WITHOUT botifying the seat.
            for (const [pid, e] of guestConns) {
              if (e.playerId === rejoin.playerId && e.conn !== conn) {
                e.playerId = null;
                guestConns.delete(pid);
                try { e.conn.close(); } catch { /* noop */ }
              }
            }
            entry.playerId = rejoin.playerId;
            store.reclaimSeat(rejoin.playerId, msg.name);
            conn.send({ t: 'welcome', playerId: rejoin.playerId, token: rejoin.token } satisfies HostMessage);
            conn.send({ t: 'full', snap: currentSnapshot() } satisfies HostMessage);
            broadcastRoster();
            return;
          }

          if (store.screen !== 'lobby') {
            conn.send({ t: 'error', code: 'in-game' } satisfies HostMessage);
            conn.close();
            return;
          }
          const playerId = store.addRemotePlayer(msg.name, msg.points);
          if (!playerId) {
            conn.send({ t: 'error', code: 'room-full' } satisfies HostMessage);
            conn.close();
            return;
          }
          const token = crypto.randomUUID();
          seatTokens.set(playerId, token);
          entry.playerId = playerId;
          conn.send({ t: 'welcome', playerId, token } satisfies HostMessage);
          conn.send({ t: 'full', snap: currentSnapshot() } satisfies HostMessage);
          broadcastRoster();
          return;
        }

        if (msg.t === 'action' && entry.playerId) {
          store.applyGuestAction(entry.playerId, msg as GuestAction);
        }
      });

      conn.on('close', () => dropGuest(conn.peer));
      conn.on('error', () => {
        // Treated like a close; the close event (or the heartbeat) cleans up
      });
    });

    // Incoming camera/mic calls (mesh AV) — answered by the AV layer.
    p.on('call', (call) => {
      avSubscriber?.onCall(call.peer, call);
    });

    p.on('error', (err) => {
      const type = (err as { type?: string }).type;
      if (type === 'unavailable-id') {
        reject(new Error('code-taken'));
      } else if (type === 'peer-unavailable') {
        // A dial (data or media) to a peer that already left — never fatal.
      } else if (!p.open) {
        reject(new Error('connection-failed'));
      }
    });

    p.on('disconnected', () => {
      // Broker connection lost — existing WebRTC links keep working;
      // try to reconnect so new guests can still join.
      if (peer === p && !p.destroyed) {
        try { p.reconnect(); } catch { /* noop */ }
      }
    });
  });
}

/* ─── Guest ────────────────────────────────────────────────────────── */

export function joinRoom(code: string, name: string): Promise<void> {
  return joinRoomInternal(code, name);
}

function startGuestWatch() {
  if (guestWatchTimer) clearInterval(guestWatchTimer);
  guestWatchTimer = setInterval(() => {
    if (!hostConn || leftVoluntarily) return;
    if (Date.now() - lastPingFromHost > STALE_LINK_MS) {
      // Host went silent — assume the link is dead and rebuild it.
      scheduleGuestReconnect();
    }
  }, 4000);
}

function scheduleGuestReconnect() {
  if (leftVoluntarily || reconnecting) return;
  if (!reconnectInfo) {
    useGameStore.getState().handleHostLeft();
    return;
  }
  reconnecting = true;
  stopTimers();
  useGameStore.setState({ onlineReconnecting: true });
  attemptReconnect(1);
}

function attemptReconnect(attempt: number) {
  const info = reconnectInfo;
  if (!info || leftVoluntarily) { reconnecting = false; return; }
  destroySession(); // drop the dead peer/conn before rebuilding
  joinRoomInternal(info.code, info.name)
    .then(() => {
      reconnecting = false;
      useGameStore.setState({ onlineReconnecting: false });
      // Media calls died with the old connection — drop them and let the
      // fresh roster broadcast re-dial everyone.
      avSubscriber?.onReset();
    })
    .catch(() => {
      if (leftVoluntarily) { reconnecting = false; return; }
      if (attempt >= RECONNECT_ATTEMPTS) {
        reconnecting = false;
        clearStoredTicket();
        useGameStore.setState({ onlineReconnecting: false });
        useGameStore.getState().handleHostLeft();
        return;
      }
      reconnectTimer = setTimeout(() => attemptReconnect(attempt + 1), RECONNECT_DELAY_MS);
    });
}

function joinRoomInternal(code: string, name: string): Promise<void> {
  leftVoluntarily = false;
  return new Promise((resolve, reject) => {
    let settled = false;
    let connectAttempts = 0;

    const p = new Peer(peerOptions());
    peer = p;

    const timeout = setTimeout(() => fail('timeout'), JOIN_TIMEOUT_MS);

    const fail = (reason: string) => {
      clearTimeout(timeout);
      if (!settled) {
        settled = true;
        reject(new Error(reason));
        destroySession();
      }
    };

    const tryConnect = () => {
      connectAttempts++;
      const conn = p.connect(`${ROOM_PREFIX}${code}`, { reliable: true });
      hostConn = conn;

      conn.on('open', () => {
        // Present our seat ticket if we were in THIS room before — the
        // host gives us our old seat back (works after a network drop, a
        // page reload, or even the app being killed on the same device).
        const ticket = readTicket();
        const rejoin = ticket && ticket.code === code
          ? { playerId: ticket.playerId, token: ticket.token }
          : undefined;
        // Carry the wallet: fresh seats start with the profile's saved ⭐
        const points = loadProfile()?.points ?? 0;
        conn.send({ t: 'join', name, points, rejoin } satisfies GuestMessage);
      });

      conn.on('data', (raw) => {
        const msg = raw as HostMessage;
        const store = useGameStore.getState();
        lastPingFromHost = Date.now(); // any traffic counts as life

        if (msg.t === 'ping') {
          if (conn.open) { try { conn.send({ t: 'pong' } satisfies GuestMessage); } catch { /* noop */ } }
          return;
        }
        if (msg.t === 'welcome') {
          clearTimeout(timeout);
          if (!settled) { settled = true; resolve(); }
          useGameStore.setState({
            localPlayerId: msg.playerId,
            onlineRole: 'guest',
            roomCode: code,
            onlineError: null,
            onlineReconnecting: false,
          });
          setMyPlayerId(msg.playerId);
          storeTicket({ code, name, playerId: msg.playerId, token: msg.token, ts: Date.now() });
          reconnectInfo = { code, name };
          lastPingFromHost = Date.now();
          startGuestWatch();
          return;
        }
        if (msg.t === 'full') {
          store._applySnapshot(msg.snap);
          return;
        }
        if (msg.t === 'peers') {
          lastRoster = msg.list;
          avSubscriber?.onRoster(msg.list);
          return;
        }
        if (msg.t === 'error') {
          fail(msg.code);
          return;
        }
        if (msg.t === 'bye') {
          clearTimeout(timeout);
          leftVoluntarily = true; // suppress the close-handler duplicate
          clearStoredTicket();
          useGameStore.getState().handleHostLeft();
          destroySession();
        }
      });

      conn.on('close', () => {
        if (leftVoluntarily) return;
        if (!settled) { fail('connection-failed'); return; }
        // Live session dropped — try to silently rebuild it before
        // declaring the host gone.
        scheduleGuestReconnect();
      });
    };

    p.on('open', tryConnect);

    // Incoming camera/mic calls (mesh AV) — answered by the AV layer.
    p.on('call', (call) => {
      avSubscriber?.onCall(call.peer, call);
    });

    p.on('disconnected', () => {
      if (peer === p && !p.destroyed) {
        try { p.reconnect(); } catch { /* noop */ }
      }
    });

    p.on('error', (err) => {
      const type = (err as { type?: string }).type;
      // CRITICAL: after the join settles, peer-level errors must NEVER tear
      // the session down. 'peer-unavailable' also fires for failed MEDIA
      // dials (e.g. calling a participant who just left) — the old code
      // destroyed the whole game session on that, kicking players out.
      if (settled) return;
      if (type === 'peer-unavailable') {
        // Transient broker miss is common — retry before "room not found".
        if (connectAttempts < JOIN_CONNECT_ATTEMPTS) {
          setTimeout(() => {
            if (!settled && peer === p && !p.destroyed) tryConnect();
          }, JOIN_RETRY_DELAY_MS);
        } else {
          fail('room-not-found');
        }
      } else {
        fail('connection-failed');
      }
    });
  });
}

/* ─── Shared ───────────────────────────────────────────────────────── */

/** Guest → host action forwarding. */
export function sendActionToHost(action: GuestAction) {
  if (hostConn?.open) {
    hostConn.send({ t: 'action', ...action } satisfies GuestMessage);
  }
}

/** Leave the room (both roles). Host notifies guests first. */
export function leaveRoom() {
  leftVoluntarily = true;
  reconnecting = false;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  reconnectInfo = null;
  // Only a VOLUNTARY exit from a live guest session abandons the seat.
  // leaveRoom is also called as defensive cleanup on every navigation
  // (openLobby/goHome with no session) — that must not wipe the ticket,
  // or the "rejoin your room" shortcut would never survive a page reload.
  if (hostConn) clearStoredTicket();
  seatTokens.clear();
  for (const { conn } of guestConns.values()) {
    if (conn.open) {
      try { conn.send({ t: 'bye' } satisfies HostMessage); } catch { /* noop */ }
    }
  }
  destroySession();
}
