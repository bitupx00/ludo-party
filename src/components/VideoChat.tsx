import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Peer, { type DataConnection } from 'peerjs';
import VideoTile from './VideoTile.tsx';
import { useGameStore } from '../store/gameStore.ts';
import { useVideoStore } from '../store/videoStore.ts';
import { PLAYER_CONFIG } from '../game/types.ts';
import type { Color } from '../game/types.ts';

/* ─── Types ──────────────────────────────────────────────────────── */

interface RemotePeer {
  id: string;
  name: string;
  color: Color;
  emoji: string;
  conn: DataConnection;
  stream: MediaStream | null;
  isSpeaking: boolean;
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

/* ─── Helpers ─────────────────────────────────────────────────────── */

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

const COLORS_ORDER: Color[] = ['red', 'green', 'yellow', 'blue'];

function pickNextColor(usedColors: Set<Color>): Color {
  for (const c of COLORS_ORDER) {
    if (!usedColors.has(c)) return c;
  }
  return 'red';
}

/* ─── Component ───────────────────────────────────────────────────── */

export default function VideoChat() {
  const players = useGameStore(s => s.players);

  // Mount as long as ANY human is at the table. Unmounting on bot turns
  // (the old check used the rotating currentPlayer) killed the PeerJS
  // connection and camera every time a bot played.
  const hasHuman = players.some(p => !p.isBot);
  if (!hasHuman) return null;

  return <VideoChatInner />;
}

function VideoChatInner() {
  const players = useGameStore(s => s.players);
  const localPlayerId = useGameStore(s => s.localPlayerId);
  // Local identity = the device holder: the identified local player (online),
  // otherwise the first human — never the rotating current player.
  const currentPlayer = (localPlayerId && players.find(p => p.id === localPlayerId))
    || players.find(p => !p.isBot);
  const playerConfig = currentPlayer ? PLAYER_CONFIG[currentPlayer.color] : null;

  const [isOpen, setIsOpen] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [remotePeers, setRemotePeers] = useState<RemotePeer[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [volume, setVolume] = useState(0.8);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const peerRef = useRef<Peer | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const remoteAudioContextsRef = useRef<Map<string, AnalyserNode>>(new Map());
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHostingRef = useRef(false);

  /* ─── Cleanup ────────────────────────────────────────────────── */

  const cleanupPeer = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    // Clean up remote streams
    remoteStreamsRef.current.clear();
    remoteAudioContextsRef.current.forEach(node => {
      try { node.disconnect(); } catch {}
    });
    remoteAudioContextsRef.current.clear();
    setRemotePeers([]);
    setConnectionStatus('disconnected');
  }, []);

  const cleanupLocalStream = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
  }, []);

  /* ─── Acquire local media ────────────────────────────────────── */

  const acquireLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' },
        audio: true,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setCameraError(null);
      // Publish to the game UI: the local camera renders inside the avatar circle
      useVideoStore.getState().setLocal(currentPlayer?.color ?? null, stream);
      useVideoStore.getState().setCameraOn(stream.getVideoTracks().length > 0);
      useVideoStore.getState().setMicOn(true);
      return stream;
    } catch (err) {
      const name = (err as DOMException).name;
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setCameraError('No se pudo acceder a la cámara 📷❌');
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setCameraError('No se encontró cámara 📷');
      } else {
        setCameraError('Error al acceder a la cámara 📷❌');
        console.warn('VideoChat: media error', err);
      }
      // Fallback: audio only
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = audioStream;
        setLocalStream(audioStream);
        setCameraError(null);
        setCameraOn(false);
        useVideoStore.getState().setLocal(currentPlayer?.color ?? null, audioStream);
        useVideoStore.getState().setCameraOn(false);
        return audioStream;
      } catch {
        setCameraError('No se pudo acceder al micrófono 🎤❌');
        return null;
      }
    }
  }, [currentPlayer?.color]);

  /* ─── Toggle camera track ────────────────────────────────────── */

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setCameraOn(videoTrack.enabled);
      useVideoStore.getState().setCameraOn(videoTrack.enabled);
    }
  }, []);

  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setMicOn(audioTrack.enabled);
      useVideoStore.getState().setMicOn(audioTrack.enabled);
    }
  }, []);

  /* ─── Speaking detection ─────────────────────────────────────── */

  const setupSpeakingDetection = useCallback((peerId: string, stream: MediaStream) => {
    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      remoteAudioContextsRef.current.set(peerId, analyser);
    } catch {
      // Audio context not supported — skip
    }
  }, []);

  useEffect(() => {
    if (remoteAudioContextsRef.current.size === 0) return;
    const dataArrays = new Map<string, Uint8Array<ArrayBuffer>>();
    for (const [id, analyser] of remoteAudioContextsRef.current) {
      dataArrays.set(id, new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>);
    }

    let raf: number;
    const detect = () => {
      const updates = new Map<string, boolean>();
      for (const [id, analyser] of remoteAudioContextsRef.current) {
        const data = dataArrays.get(id);
        if (!data) continue;
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        updates.set(id, avg > 8);
      }
      setRemotePeers(prev => prev.map(p => {
        const speaking = updates.get(p.id);
        return speaking !== undefined ? { ...p, isSpeaking: speaking } : p;
      }));
      raf = requestAnimationFrame(detect);
    };
    raf = requestAnimationFrame(detect);
    return () => cancelAnimationFrame(raf);
  }, [connectionStatus]);

  /* ─── Connect local video element ────────────────────────────── */

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  /* ─── Mirror remote streams into avatar circles (by color) ─────── */

  useEffect(() => {
    const store = useVideoStore.getState();
    const localColor = currentPlayer?.color;
    const activeColors = new Set<Color>();
    for (const peer of remotePeers) {
      if (peer.color === localColor) continue;
      activeColors.add(peer.color);
      store.setRemote(peer.color, peer.stream);
      store.setSpeaking(peer.color, peer.isSpeaking);
    }
    // Remove colors whose peer left
    for (const color of COLORS_ORDER) {
      if (color === localColor) continue;
      if (!activeColors.has(color) && useVideoStore.getState().streams[color]) {
        store.setRemote(color, null);
        store.setSpeaking(color, false);
      }
    }
  }, [remotePeers, currentPlayer?.color]);

  /* ─── Publish camera/mic controls to the game HUD ────────────────── */

  useEffect(() => {
    if (localStream) {
      useVideoStore.getState().setControls({ toggleCamera, toggleMic });
    }
    return () => {
      useVideoStore.getState().setControls(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStream]);

  /* ─── Host a room ─────────────────────────────────────────────── */

  const handleHost = useCallback(async () => {
    const code = generateRoomCode();
    setRoomCode(code);
    isHostingRef.current = true;

    const stream = await acquireLocalStream();
    if (!stream) return;

    setConnectionStatus('connecting');
    setRoomCode(code);
    setIsEnabled(true);

    const peer = new Peer(`ludo-party-${code}`);

    peer.on('open', () => {
      setConnectionStatus('connected');
    });

    peer.on('connection', (conn) => {
      handleIncomingConnection(conn, stream);
    });

    peer.on('call', (call) => {
      call.answer(stream);
      call.on('stream', (remoteStream) => {
        remoteStreamsRef.current.set(call.peer, remoteStream);
        setupSpeakingDetection(call.peer, remoteStream);
        setRemotePeers(prev => {
          const existing = prev.find(p => p.id === call.peer);
          if (existing) {
            return prev.map(p => p.id === call.peer ? { ...p, stream: remoteStream } : p);
          }
          // New peer from a call
          const usedColors = new Set([currentPlayer?.color, ...prev.map(p => p.color)]);
          const color = pickNextColor(usedColors as Set<Color>);
          return [...prev, {
            id: call.peer,
            name: 'Amigo 🎮',
            color,
            emoji: PLAYER_CONFIG[color].emoji,
            conn: {} as DataConnection,
            stream: remoteStream,
            isSpeaking: false,
          }];
        });
      });
    });

    peer.on('error', (err) => {
      console.warn('VideoChat peer error:', err);
      if (err.type === 'unavailable-id') {
        // Room code collision — regenerate
        peer.destroy();
        const newCode = generateRoomCode();
        setRoomCode(newCode);
        const retryPeer = new Peer(`ludo-party-${newCode}`);
        retryPeer.on('open', () => setConnectionStatus('connected'));
        retryPeer.on('connection', (conn) => handleIncomingConnection(conn, stream));
        retryPeer.on('call', (call) => {
          call.answer(stream);
          call.on('stream', (remoteStream) => {
            remoteStreamsRef.current.set(call.peer, remoteStream);
            setupSpeakingDetection(call.peer, remoteStream);
            setRemotePeers(prev => prev.map(p => p.id === call.peer ? { ...p, stream: remoteStream } : p));
          });
        });
        retryPeer.on('error', () => setConnectionStatus('disconnected'));
        peerRef.current = retryPeer;
      } else if (err.type === 'peer-unavailable') {
        // The peer we tried to call is gone
      } else {
        setConnectionStatus('disconnected');
      }
    });

    peer.on('disconnected', () => {
      setConnectionStatus('disconnected');
      // Auto-reconnect
      reconnectTimeoutRef.current = setTimeout(() => {
        if (peerRef.current && !peerRef.current.destroyed) {
          peerRef.current.reconnect();
        }
      }, 3000);
    });

    peerRef.current = peer;
  }, [acquireLocalStream, currentPlayer, setupSpeakingDetection]);

  /* ─── Handle incoming connections (host side) ─────────────────── */

  const handleIncomingConnection = useCallback((
    conn: DataConnection,
    localStream: MediaStream,
  ) => {
    conn.on('open', () => {
      // Send our info
      conn.send({
        type: 'hello',
        name: currentPlayer?.name ?? 'Jugador',
        color: currentPlayer?.color ?? 'red',
        emoji: currentPlayer?.emoji ?? '🎲',
      });

      // Call them with our stream
      const call = peerRef.current?.call(conn.peer, localStream);
      if (call) {
        call.on('stream', (remoteStream) => {
          remoteStreamsRef.current.set(conn.peer, remoteStream);
          setupSpeakingDetection(conn.peer, remoteStream);
          setRemotePeers(prev => {
            const existing = prev.find(p => p.id === conn.peer);
            if (existing) {
              return prev.map(p => p.id === conn.peer ? { ...p, stream: remoteStream } : p);
            }
            return prev;
          });
        });
      }
    });

    conn.on('data', (data: unknown) => {
      const msg = data as { type: string; name: string; color: Color; emoji: string };
      if (msg.type === 'hello') {
        const usedColors = new Set<Color>([
          currentPlayer?.color ?? 'red',
          ...remotePeers.map(p => p.color),
        ]);
        const color = pickNextColor(usedColors);
        setRemotePeers(prev => {
          if (prev.find(p => p.id === conn.peer)) return prev;
          return [...prev, {
            id: conn.peer,
            name: msg.name,
            color: msg.color ?? color,
            emoji: msg.emoji ?? PLAYER_CONFIG[color].emoji,
            conn,
            stream: remoteStreamsRef.current.get(conn.peer) ?? null,
            isSpeaking: false,
          }];
        });
      }
    });

    conn.on('close', () => {
      remoteStreamsRef.current.delete(conn.peer);
      const analyser = remoteAudioContextsRef.current.get(conn.peer);
      if (analyser) {
        try { analyser.disconnect(); } catch {}
        remoteAudioContextsRef.current.delete(conn.peer);
      }
      setRemotePeers(prev => prev.filter(p => p.id !== conn.peer));
    });
  }, [currentPlayer, remotePeers, setupSpeakingDetection]);

  /* ─── Join a room ─────────────────────────────────────────────── */

  const handleJoin = useCallback(async () => {
    if (!joinCode.trim()) return;

    const stream = await acquireLocalStream();
    if (!stream) return;

    setConnectionStatus('connecting');
    setIsEnabled(true);
    isHostingRef.current = false;
    setRoomCode(joinCode.trim().toUpperCase());

    const peer = new Peer();

    peer.on('open', () => {
      const conn = peer.connect(`ludo-party-${joinCode.trim().toUpperCase()}`);

      conn.on('open', () => {
        setConnectionStatus('connected');
        conn.send({
          type: 'hello',
          name: currentPlayer?.name ?? 'Jugador',
          color: currentPlayer?.color ?? 'red',
          emoji: currentPlayer?.emoji ?? '🎲',
        });
      });

      conn.on('data', (data: unknown) => {
        const msg = data as { type: string; name: string; color: Color; emoji: string };
        if (msg.type === 'hello') {
          setRemotePeers(prev => {
            if (prev.find(p => p.id === conn.peer)) return prev;
            return [...prev, {
              id: conn.peer,
              name: msg.name,
              color: msg.color ?? 'green',
              emoji: msg.emoji ?? '🎮',
              conn,
              stream: remoteStreamsRef.current.get(conn.peer) ?? null,
              isSpeaking: false,
            }];
          });
        }
      });

      conn.on('close', () => {
        remoteStreamsRef.current.delete(conn.peer);
        setRemotePeers(prev => prev.filter(p => p.id !== conn.peer));
        setConnectionStatus('disconnected');
      });
    });

    // Receive incoming calls
    peer.on('call', (call) => {
      call.answer(stream);
      call.on('stream', (remoteStream) => {
        remoteStreamsRef.current.set(call.peer, remoteStream);
        setupSpeakingDetection(call.peer, remoteStream);
        setRemotePeers(prev => {
          const existing = prev.find(p => p.id === call.peer);
          if (existing) {
            return prev.map(p => p.id === call.peer ? { ...p, stream: remoteStream } : p);
          }
          return prev;
        });
      });
    });

    peer.on('error', (err) => {
      console.warn('VideoChat join error:', err);
      if (err.type === 'peer-unavailable') {
        setConnectionStatus('disconnected');
        setRoomCode('');
        setRoomCode('');
      } else {
        setConnectionStatus('disconnected');
      }
    });

    peer.on('disconnected', () => {
      setConnectionStatus('disconnected');
      reconnectTimeoutRef.current = setTimeout(() => {
        if (peerRef.current && !peerRef.current.destroyed) {
          peerRef.current.reconnect();
        }
      }, 3000);
    });

    peerRef.current = peer;
    setJoinCode('');
  }, [joinCode, acquireLocalStream, currentPlayer, setupSpeakingDetection]);

  /* ─── Disconnect ─────────────────────────────────────────────── */

  const handleDisconnect = useCallback(() => {
    cleanupPeer();
    cleanupLocalStream();
    setIsEnabled(false);
    setRoomCode('');
    setCameraError(null);
    setCameraOn(true);
    setMicOn(true);
    useVideoStore.getState().clearAll();
  }, [cleanupPeer, cleanupLocalStream]);

  /* ─── Cleanup on unmount ─────────────────────────────────────── */

  useEffect(() => {
    return () => {
      cleanupPeer();
      cleanupLocalStream();
      useVideoStore.getState().clearAll();
    };
  }, [cleanupPeer, cleanupLocalStream]);

  /* ─── Copy room code ─────────────────────────────────────────── */

  const handleCopyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = roomCode;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  }, [roomCode]);

  /* ─── Render ───────────────────────────────────────────────────── */

  const peerCount = remotePeers.length + 1; // +1 for self
  const statusEmoji = connectionStatus === 'connected' ? '🟢'
    : connectionStatus === 'connecting' ? '🟡'
    : '🔴';
  const statusText = connectionStatus === 'connected' ? 'Conectado'
    : connectionStatus === 'connecting' ? 'Conectando...'
    : 'Desconectado';

  return (
    <>
      {/* Toggle button (always visible) */}
      <motion.button
        className="videochat-toggle glass"
        onClick={() => setIsOpen(!isOpen)}
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.1 }}
        title="Videochat"
      >
        <span style={{ fontSize: '1.2rem' }}>📹</span>
        {isEnabled && (
          <motion.span
            className="videochat-toggle-badge"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            style={{
              background: connectionStatus === 'connected' ? 'var(--color-green)' : 'var(--color-yellow)',
            }}
          >
            {peerCount}
          </motion.span>
        )}
      </motion.button>

      {/* Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="videochat-panel glass"
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          >
            <div className="videochat-header">
              <span className="videochat-title">📹 Videochat</span>
              <button className="videochat-close" onClick={() => setIsOpen(false)}>✕</button>
            </div>

            {!isEnabled ? (
              /* ─── Setup screen ─────────────────────────── */
              <div className="videochat-setup">
                <p className="videochat-setup-desc">
                  Conecta con tus amigos para jugar con video y audio 🎮🎬
                </p>

                <button className="btn btn-primary videochat-btn" onClick={handleHost}>
                  🏠 Crear sala
                </button>

                <div className="videochat-divider">o</div>

                <div className="videochat-join">
                  <input
                    className="videochat-join-input"
                    type="text"
                    placeholder="Código de sala..."
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                    onKeyDown={e => e.key === 'Enter' && handleJoin()}
                    maxLength={6}
                  />
                  <button
                    className="btn btn-secondary videochat-join-btn"
                    onClick={handleJoin}
                    disabled={joinCode.length < 4}
                  >
                    🚀 Unirse
                  </button>
                </div>

                {cameraError && (
                  <motion.p
                    className="videochat-error"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    {cameraError}
                  </motion.p>
                )}
              </div>
            ) : (
              /* ─── Connected screen ──────────────────────── */
              <div className="videochat-connected">
                {/* Room code */}
                {roomCode && (
                  <div className="videochat-room-section">
                    <div className="videochat-room-code">
                      <span className="videochat-room-label">Código de sala</span>
                      <span className="videochat-room-code-value">{roomCode}</span>
                    </div>
                    <button className="videochat-copy-btn" onClick={handleCopyCode}>
                      {copiedCode ? '✅ ¡Copiado!' : '📋 Compartir código'}
                    </button>
                  </div>
                )}

                {/* Connection status */}
                <div className="videochat-status">
                  <span>{statusEmoji} {statusText}</span>
                  <span className="videochat-peer-count">
                    👥 {peerCount}/4 conectados
                  </span>
                </div>

                {/* Video tiles */}
                <div className="videochat-tiles">
                  {/* Local video */}
                  {localStream && playerConfig && (
                    <div className="videochat-tile-item">
                      <VideoTile
                        stream={localStream}
                        emoji={currentPlayer?.emoji ?? '🎲'}
                        name={`${currentPlayer?.name ?? 'Tú'} (yo)`}
                        color={playerConfig.cssColor}
                        isSpeaking={false}
                        size={68}
                        isLocal={true}
                        muted={!micOn}
                      />
                    </div>
                  )}

                  {/* Remote peers */}
                  <AnimatePresence>
                    {remotePeers.map(peer => {
                      const config = PLAYER_CONFIG[peer.color];
                      return (
                        <motion.div
                          key={peer.id}
                          className="videochat-tile-item"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                        >
                          <VideoTile
                            stream={peer.stream}
                            emoji={peer.emoji}
                            name={peer.name}
                            color={config.cssColor}
                            isSpeaking={peer.isSpeaking}
                            size={68}
                            muted={false}
                          />
                          {/* Volume control for remote peer */}
                          {peer.stream && (
                            <input
                              type="range"
                              className="videochat-volume-slider"
                              min="0"
                              max="1"
                              step="0.1"
                              value={volume}
                              onChange={e => {
                                const v = parseFloat(e.target.value);
                                setVolume(v);
                                peer.stream?.getAudioTracks().forEach(t => {
                                  t.enabled = v > 0;
                                });
                              }}
                            />
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>

                  {/* Empty slots */}
                  {Array.from({ length: Math.max(0, 4 - peerCount) }).map((_, i) => (
                    <div key={`empty-${i}`} className="videochat-tile-item videochat-tile-empty">
                      <div className="videochat-empty-slot">
                        <span>🎮</span>
                        <span className="videochat-empty-text">Vacío</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Controls */}
                <div className="videochat-controls">
                  <motion.button
                    className="videochat-control-btn"
                    onClick={toggleCamera}
                    whileTap={{ scale: 0.85 }}
                    style={{
                      background: cameraOn ? 'rgba(255,255,255,0.12)' : 'rgba(255, 71, 87, 0.3)',
                    }}
                    title={cameraOn ? 'Apagar cámara' : 'Encender cámara'}
                  >
                    <motion.span
                      animate={{ rotate: cameraOn ? 0 : 180 }}
                      transition={{ duration: 0.3 }}
                    >
                      {cameraOn ? '📷' : '🚫'}
                    </motion.span>
                  </motion.button>

                  <motion.button
                    className="videochat-control-btn"
                    onClick={toggleMic}
                    whileTap={{ scale: 0.85 }}
                    style={{
                      background: micOn ? 'rgba(255,255,255,0.12)' : 'rgba(255, 71, 87, 0.3)',
                    }}
                    title={micOn ? 'Silenciar micrófono' : 'Activar micrófono'}
                  >
                    <motion.span
                      animate={{ scale: micOn ? 1 : 0.8 }}
                      transition={{ duration: 0.2 }}
                    >
                      {micOn ? '🎤' : '🔇'}
                    </motion.span>
                  </motion.button>

                  <motion.button
                    className="videochat-control-btn videochat-control-btn--danger"
                    onClick={handleDisconnect}
                    whileTap={{ scale: 0.85 }}
                    title="Desconectar"
                  >
                    📞❌
                  </motion.button>
                </div>

                {cameraError && (
                  <p className="videochat-error-small">{cameraError}</p>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden local video element for stream mirroring */}
      <video ref={localVideoRef} autoPlay playsInline muted style={{ display: 'none' }} />

      <style>{videoChatStyles}</style>
    </>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────── */

const videoChatStyles = `
/* Toggle button — top right (bottom is occupied by the dice HUD) */
.videochat-toggle {
  position: fixed;
  top: calc(var(--gap-sm) + env(safe-area-inset-top));
  right: var(--gap-md);
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  color: var(--color-text);
  font-size: 1.3rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  transition: all var(--transition-fast);
}
.videochat-toggle:hover {
  background: var(--color-surface-hover);
}

.videochat-toggle-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 20px;
  height: 20px;
  border-radius: 10px;
  color: white;
  font-size: 0.65rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}

/* Panel */
.videochat-panel {
  position: fixed;
  top: calc(var(--gap-sm) + 56px + env(safe-area-inset-top));
  right: var(--gap-md);
  width: min(340px, 88vw);
  z-index: 80;
  overflow: hidden;
}

.videochat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--gap-md) var(--gap-md) var(--gap-sm);
}

.videochat-title {
  font-size: 1rem;
  font-weight: 800;
  background: linear-gradient(135deg, var(--color-green), var(--color-blue));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.videochat-close {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.08);
  color: var(--color-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  transition: all var(--transition-fast);
}
.videochat-close:hover {
  background: rgba(255, 71, 87, 0.3);
  color: white;
}

/* Setup screen */
.videochat-setup {
  padding: 0 var(--gap-md) var(--gap-md);
  display: flex;
  flex-direction: column;
  gap: var(--gap-md);
}

.videochat-setup-desc {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  text-align: center;
  line-height: 1.4;
}

.videochat-btn {
  width: 100%;
}

.videochat-divider {
  text-align: center;
  color: var(--color-text-muted);
  font-size: 0.75rem;
  position: relative;
}
.videochat-divider::before,
.videochat-divider::after {
  content: '';
  position: absolute;
  top: 50%;
  width: calc(50% - 16px);
  height: 1px;
  background: var(--color-border);
}
.videochat-divider::before { left: 0; }
.videochat-divider::after { right: 0; }

.videochat-join {
  display: flex;
  gap: var(--gap-sm);
}

.videochat-join-input {
  flex: 1;
  min-width: 0;
  padding: 10px 14px;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.06);
  color: var(--color-text);
  font-family: inherit;
  font-size: 0.95rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 3px;
  text-align: center;
  outline: none;
  transition: border-color var(--transition-fast);
}
.videochat-join-input:focus {
  border-color: var(--color-green);
  box-shadow: 0 0 0 3px rgba(46, 213, 115, 0.15);
}
.videochat-join-input::placeholder {
  text-transform: none;
  letter-spacing: 0;
  font-weight: 500;
  color: var(--color-text-muted);
  font-size: 0.8rem;
}

.videochat-join-btn {
  flex-shrink: 0;
}

/* Error */
.videochat-error {
  font-size: 0.78rem;
  color: var(--color-red);
  text-align: center;
  padding: 6px 10px;
  background: rgba(255, 71, 87, 0.1);
  border-radius: var(--radius-sm);
}
.videochat-error-small {
  font-size: 0.7rem;
  color: var(--color-red);
  text-align: center;
  padding: 2px 8px;
  margin-top: var(--gap-xs);
}

/* Connected screen */
.videochat-connected {
  padding: 0 var(--gap-md) var(--gap-md);
  display: flex;
  flex-direction: column;
  gap: var(--gap-md);
}

/* Room section */
.videochat-room-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--gap-xs);
}

.videochat-room-code {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.videochat-room-label {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.videochat-room-code-value {
  font-size: 1.8rem;
  font-weight: 900;
  letter-spacing: 6px;
  color: var(--color-green);
  text-shadow: 0 0 20px rgba(46, 213, 115, 0.5);
  font-family: 'Courier New', monospace;
}

.videochat-copy-btn {
  padding: 6px 14px;
  border-radius: var(--radius-full);
  border: 1px solid var(--glass-border);
  background: rgba(255, 255, 255, 0.06);
  color: var(--color-text-secondary);
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
}
.videochat-copy-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: var(--color-text);
}
.videochat-copy-btn:active {
  transform: scale(0.95);
}

/* Status */
.videochat-status {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: var(--radius-sm);
}

.videochat-peer-count {
  font-weight: 700;
  color: var(--color-green);
}

/* Video tiles grid */
.videochat-tiles {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--gap-md);
  padding: var(--gap-sm) 0;
}

.videochat-tile-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--gap-xs);
}

.videochat-tile-empty .videochat-empty-slot {
  width: 68px;
  height: 68px;
  border-radius: 50%;
  border: 2px dashed rgba(255, 255, 255, 0.15);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  font-size: 1.2rem;
  opacity: 0.4;
}

.videochat-empty-text {
  font-size: 0.5rem;
  color: var(--color-text-muted);
}

/* Volume slider */
.videochat-volume-slider {
  width: 56px;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}
.videochat-volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--color-green);
  cursor: pointer;
}

/* Controls */
.videochat-controls {
  display: flex;
  justify-content: center;
  gap: var(--gap-sm);
  padding-top: var(--gap-sm);
  border-top: 1px solid var(--color-border);
}

.videochat-control-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.12);
  font-size: 1.2rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
  color: var(--color-text);
}
.videochat-control-btn:hover {
  border-color: rgba(255, 255, 255, 0.25);
  transform: scale(1.08);
}
.videochat-control-btn--danger {
  border-color: rgba(255, 71, 87, 0.3);
}
.videochat-control-btn--danger:hover {
  background: rgba(255, 71, 87, 0.2);
  border-color: var(--color-red);
}

/* Mobile adjustments */
@media (max-width: 480px) {
  .videochat-panel {
    right: var(--gap-sm);
    left: var(--gap-sm);
    width: auto;
    top: calc(var(--gap-sm) + 56px + env(safe-area-inset-top));
  }
  .videochat-room-code-value {
    font-size: 1.4rem;
    letter-spacing: 4px;
  }
}
`;
