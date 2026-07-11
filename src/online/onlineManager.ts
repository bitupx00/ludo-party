import Peer, { type DataConnection, type PeerOptions } from 'peerjs';
import { useGameStore, SNAPSHOT_KEYS, type GameSnapshot } from '../store/gameStore';

/**
 * Online multiplayer over PeerJS (WebRTC data channels), host-authoritative:
 * the host runs the game engine (and the bots); guests send their inputs and
 * mirror the host's state snapshots. No game server needed.
 */

/* ─── Protocol ────────────────────────────────────────────────────── */

export type GuestAction =
  | { a: 'roll' }
  | { a: 'select'; pieceId: string }
  | { a: 'reaction'; emoji: string }
  | { a: 'chat'; text: string };

type GuestMessage =
  | { t: 'join'; name: string }
  | ({ t: 'action' } & GuestAction);

type HostMessage =
  | { t: 'welcome'; playerId: string }
  | { t: 'full'; snap: GameSnapshot }
  | { t: 'error'; code: 'room-full' | 'in-game' }
  | { t: 'bye' };

const ROOM_PREFIX = 'ludo-party-room-';

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
const guestConns = new Map<string, { conn: DataConnection; playerId: string | null }>();
let unsubscribeStore: (() => void) | null = null;
let lastBroadcast = '';
let leftVoluntarily = false;

function destroySession() {
  if (unsubscribeStore) { unsubscribeStore(); unsubscribeStore = null; }
  for (const { conn } of guestConns.values()) {
    try { conn.close(); } catch { /* noop */ }
  }
  guestConns.clear();
  if (hostConn) { try { hostConn.close(); } catch { /* noop */ } hostConn = null; }
  if (peer) { try { peer.destroy(); } catch { /* noop */ } peer = null; }
  lastBroadcast = '';
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

/* ─── Host ─────────────────────────────────────────────────────────── */

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
      resolve();
    });

    p.on('connection', (conn) => {
      guestConns.set(conn.peer, { conn, playerId: null });

      conn.on('data', (raw) => {
        const msg = raw as GuestMessage;
        const store = useGameStore.getState();
        const entry = guestConns.get(conn.peer);
        if (!entry) return;

        if (msg.t === 'join') {
          if (store.screen !== 'lobby') {
            conn.send({ t: 'error', code: 'in-game' } satisfies HostMessage);
            conn.close();
            return;
          }
          const playerId = store.addRemotePlayer(msg.name);
          if (!playerId) {
            conn.send({ t: 'error', code: 'room-full' } satisfies HostMessage);
            conn.close();
            return;
          }
          entry.playerId = playerId;
          conn.send({ t: 'welcome', playerId } satisfies HostMessage);
          conn.send({ t: 'full', snap: currentSnapshot() } satisfies HostMessage);
          return;
        }

        if (msg.t === 'action' && entry.playerId) {
          store.applyGuestAction(entry.playerId, msg as GuestAction);
        }
      });

      conn.on('close', () => {
        const entry = guestConns.get(conn.peer);
        guestConns.delete(conn.peer);
        if (entry?.playerId) {
          useGameStore.getState().handleGuestLeft(entry.playerId);
        }
      });

      conn.on('error', () => {
        // Treated like a close; the close handler does the cleanup
      });
    });

    p.on('error', (err) => {
      const type = (err as { type?: string }).type;
      if (type === 'unavailable-id') {
        reject(new Error('code-taken'));
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
  leftVoluntarily = false;
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (reason: string) => {
      if (!settled) { settled = true; reject(new Error(reason)); }
      destroySession();
    };

    const p = new Peer(peerOptions());
    peer = p;

    const timeout = setTimeout(() => fail('timeout'), 15000);

    p.on('open', () => {
      const conn = p.connect(`${ROOM_PREFIX}${code}`, { reliable: true });
      hostConn = conn;

      conn.on('open', () => {
        conn.send({ t: 'join', name } satisfies GuestMessage);
      });

      conn.on('data', (raw) => {
        const msg = raw as HostMessage;
        const store = useGameStore.getState();

        if (msg.t === 'welcome') {
          clearTimeout(timeout);
          if (!settled) { settled = true; resolve(); }
          useGameStore.setState({ localPlayerId: msg.playerId, onlineRole: 'guest', roomCode: code, onlineError: null });
          return;
        }
        if (msg.t === 'full') {
          store._applySnapshot(msg.snap);
          return;
        }
        if (msg.t === 'error') {
          clearTimeout(timeout);
          fail(msg.code);
          return;
        }
        if (msg.t === 'bye') {
          clearTimeout(timeout);
          leftVoluntarily = true; // suppress the close-handler duplicate
          useGameStore.getState().handleHostLeft();
          destroySession();
        }
      });

      conn.on('close', () => {
        clearTimeout(timeout);
        if (leftVoluntarily) return;
        if (!settled) { fail('connection-failed'); return; }
        useGameStore.getState().handleHostLeft();
        destroySession();
      });
    });

    p.on('error', (err) => {
      const type = (err as { type?: string }).type;
      clearTimeout(timeout);
      if (type === 'peer-unavailable') fail('room-not-found');
      else if (!settled) fail('connection-failed');
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
  for (const { conn } of guestConns.values()) {
    if (conn.open) {
      try { conn.send({ t: 'bye' } satisfies HostMessage); } catch { /* noop */ }
    }
  }
  destroySession();
}
