import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore.ts';
import { PLAYER_CONFIG } from '../game/types.ts';

const FUNNY_TIPS = [
  'Recuerda: el 6 da turno extra 😉',
  'Tranquilo, es solo un juego... 😏',
  'El rojo siempre gana... si eres bueno 🤡',
  'No te enojes, los bots también tienen sentimientos 🤖😢',
  'Consejo: atrapa a tus amigos, que se frustren 💀',
  '¡Parchís es para valientes! 💪🔥',
  'Si pierdes, culpa al WiFi 📶😤',
  'El que ríe último... ¡gana! 😂🏆',
  'Los bots no saben que están jugando 🤫',
  'Atrapar = poder volver a sacar 🎯',
];

function FloatingDice({ delay, emoji, duration }: { delay: number; emoji: string; duration: number }) {
  return (
    <motion.span
      className="floating-dice"
      initial={{ opacity: 0, y: '100vh' }}
      animate={{
        opacity: [0, 0.6, 0.4, 0],
        y: ['-10vh', '-20vh', '-40vh', '-60vh'],
        x: [0, 30, -20, 15],
        rotate: [0, 180, 360, 540],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'linear',
      }}
      style={{
        position: 'fixed',
        fontSize: '2rem',
        pointerEvents: 'none',
        zIndex: 0,
        left: `${Math.random() * 90 + 5}%`,
      }}
    >
      {emoji}
    </motion.span>
  );
}

export default function Lobby() {
  const [nameInput, setNameInput] = useState('');
  const players = useGameStore(s => s.players);
  const addPlayer = useGameStore(s => s.addPlayer);
  const removePlayer = useGameStore(s => s.removePlayer);
  const startGame = useGameStore(s => s.startGame);
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex(i => (i + 1) % FUNNY_TIPS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleAddPlayer = useCallback(() => {
    if (nameInput.trim()) {
      addPlayer(nameInput.trim());
      setNameInput('');
    }
  }, [nameInput, addPlayer]);

  const canStart = players.length >= 2;
  const canAddBots = players.length < 4;
  const diceEmojis = ['🎲', '🎲', '🎲', '🎯', '🎲', '🎲'];

  // addBots is handled by startGame (engine fills bots automatically),
  // but we still show the button as UX sugar — it just starts the game early
  const handleAddBots = useCallback(() => {
    // The engine's startGame already fills with bots.
    // If there are already 2+ players, just start.
    // If only 1, we can't start yet. Just visual feedback.
    if (players.length >= 2) {
      startGame();
    }
  }, [players.length, startGame]);

  return (
    <div className="lobby">
      {/* Floating background dice */}
      {diceEmojis.map((emoji, i) => (
        <FloatingDice
          key={i}
          emoji={emoji}
          delay={i * 1.5}
          duration={8 + i * 2}
        />
      ))}

      <div className="lobby-content">
        {/* Title */}
        <motion.h1
          className="lobby-title"
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, type: 'spring' }}
        >
          🎲 LUDO PARTY 🎲
        </motion.h1>

        <motion.p
          className="lobby-subtitle"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          El juego de mesa más divertido 🔥
        </motion.p>

        {/* Add player input */}
        <motion.div
          className="lobby-input-row"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <input
            type="text"
            className="lobby-input"
            placeholder="Tu nombre..."
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddPlayer()}
            maxLength={20}
            disabled={players.length >= 4}
          />
          <button
            className="btn btn-primary btn-add"
            onClick={handleAddPlayer}
            disabled={!nameInput.trim() || players.length >= 4}
          >
            <span>➕</span> Añadir
          </button>
        </motion.div>

        {/* Player cards */}
        <div className="lobby-players">
          <AnimatePresence>
            {players.map((player) => (
              <motion.div
                key={player.id}
                className={`lobby-player-card glass`}
                style={{ '--player-color': PLAYER_CONFIG[player.color].cssColor } as React.CSSProperties}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0, x: -100 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                whileHover={{ scale: 1.03 }}
              >
                <div className="player-card-left">
                  <span className="player-card-emoji" style={{ fontSize: '2rem' }}>
                    {PLAYER_CONFIG[player.color].emoji}
                  </span>
                  <div className="player-card-info">
                    <span className="player-card-name">{player.name}</span>
                    <span className="player-card-color" style={{ color: PLAYER_CONFIG[player.color].cssColor }}>
                      ● {PLAYER_CONFIG[player.color].label}
                    </span>
                  </div>
                </div>
                <div className="player-card-right">
                  {player.isBot && <span className="player-card-bot">🤖</span>}
                  <button
                    className="btn-remove"
                    onClick={() => removePlayer(player.id)}
                    aria-label="Eliminar jugador"
                  >
                    ✕
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {players.length === 0 && (
            <motion.div
              className="lobby-empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
            >
              🎲 Añade jugadores para empezar...
            </motion.div>
          )}
        </div>

        {/* Action buttons */}
        <motion.div
          className="lobby-actions"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          {canAddBots && (
            <motion.button
              className="btn btn-secondary"
              onClick={handleAddBots}
              whileTap={{ scale: 0.95 }}
            >
              🤖 Añadir bots ({4 - players.length} slots)
            </motion.button>
          )}

          <motion.button
            className={`btn ${canStart ? 'btn-primary' : ''}`}
            disabled={!canStart}
            onClick={startGame}
            whileTap={canStart ? { scale: 0.95 } : {}}
            style={!canStart ? { background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' } : {}}
          >
            🚀 ¡A JUGAR! {canStart ? `(${players.length} jugadores)` : 'necesitas 2+'}
          </motion.button>
        </motion.div>

        {/* Funny tips */}
        <motion.div
          className="lobby-tips"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <AnimatePresence mode="wait">
            <motion.p
              key={tipIndex}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 0.6 }}
              exit={{ y: -10, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="lobby-tip"
            >
              💡 {FUNNY_TIPS[tipIndex]}
            </motion.p>
          </AnimatePresence>
        </motion.div>
      </div>

      <style>{`
        .lobby {
          position: relative;
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: var(--gap-lg);
          overflow: hidden;
          background: radial-gradient(ellipse at top, rgba(55, 66, 250, 0.1) 0%, transparent 50%),
                      radial-gradient(ellipse at bottom-right, rgba(255, 71, 87, 0.1) 0%, transparent 50%),
                      var(--color-bg);
        }
        .floating-dice {
          position: fixed;
          pointer-events: none;
          z-index: 0;
        }
        .lobby-content {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 480px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--gap-lg);
        }
        .lobby-title {
          font-size: clamp(2rem, 8vw, 3.5rem);
          font-weight: 900;
          text-align: center;
          letter-spacing: -1px;
          animation: title-bounce 2s ease-in-out infinite;
        }
        .lobby-subtitle {
          font-size: 1.1rem;
          color: var(--color-text-secondary);
          text-align: center;
        }
        .lobby-input-row {
          display: flex;
          width: 100%;
          gap: var(--gap-sm);
        }
        .lobby-input {
          flex: 1;
          padding: 14px 18px;
          border-radius: var(--radius-full);
          border: 2px solid var(--glass-border);
          background: var(--glass-bg);
          backdrop-filter: blur(var(--glass-blur));
          color: var(--color-text);
          font-family: inherit;
          font-size: 1rem;
          font-weight: 600;
          outline: none;
          transition: border-color var(--transition-normal);
        }
        .lobby-input:focus {
          border-color: var(--color-blue-light);
        }
        .lobby-input::placeholder {
          color: var(--color-text-muted);
        }
        .btn-add {
          white-space: nowrap;
        }
        .lobby-players {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: var(--gap-sm);
          min-height: 60px;
        }
        .lobby-player-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-left: 4px solid var(--player-color);
        }
        .player-card-left {
          display: flex;
          align-items: center;
          gap: var(--gap-md);
        }
        .player-card-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .player-card-name {
          font-size: 1rem;
          font-weight: 700;
        }
        .player-card-color {
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .player-card-right {
          display: flex;
          align-items: center;
          gap: var(--gap-sm);
        }
        .player-card-bot {
          font-size: 1.2rem;
        }
        .btn-remove {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: none;
          background: rgba(255, 255, 255, 0.1);
          color: var(--color-text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.8rem;
          transition: all var(--transition-fast);
        }
        .btn-remove:hover {
          background: var(--color-red);
          color: white;
        }
        .lobby-empty {
          text-align: center;
          color: var(--color-text-muted);
          font-size: 0.9rem;
          padding: var(--gap-md);
        }
        .lobby-actions {
          display: flex;
          flex-direction: column;
          gap: var(--gap-sm);
          width: 100%;
        }
        .lobby-tips {
          text-align: center;
          min-height: 24px;
        }
        .lobby-tip {
          font-size: 0.85rem;
          color: var(--color-text-muted);
          font-style: italic;
        }
      `}</style>
    </div>
  );
}
