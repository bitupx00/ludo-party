import { useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore.ts';
import type { Color, Player } from '../game/types.ts';
import { COLORS, PLAYER_CONFIG } from '../game/types.ts';
import { BOT_NAMES, BOT_EMOJIS } from '../game/aiPlayer.ts';
import { useT } from '../i18n.ts';
import PawnSVG from './PawnSVG.tsx';

export default function Lobby() {
  const t = useT();
  const [nameInput, setNameInput] = useState('');
  const players = useGameStore((s) => s.players);
  const gameMode = useGameStore((s) => s.gameMode);
  const addPlayer = useGameStore((s) => s.addPlayer);
  const addBotPlayer = useGameStore((s) => s.addBotPlayer);
  const removePlayer = useGameStore((s) => s.removePlayer);
  const startGame = useGameStore((s) => s.startGame);
  const goHome = useGameStore((s) => s.goHome);

  const playersByColor = new Map<Color, Player>(players.map((p) => [p.color, p]));
  const humans = players.filter((p) => !p.isBot);
  const nextFreeColor = COLORS.find((c) => !playersByColor.has(c));

  const canAddHuman = nameInput.trim().length > 0 && players.length < 4
    && !(gameMode === 'solo' && humans.length >= 1);
  const canStart = gameMode === 'local' ? players.length >= 2 : humans.length >= 1;

  const handleAddPlayer = useCallback(() => {
    if (!nameInput.trim()) return;
    addPlayer(nameInput.trim());
    setNameInput('');
  }, [nameInput, addPlayer]);

  const modeTitle = gameMode === 'solo' ? t('modeSolo') : gameMode === 'teams' ? t('modeTeams') : t('modeLocal');
  const modeIcon = gameMode === 'solo' ? '🤖' : gameMode === 'teams' ? '🤝' : '👥';

  const hint = !canStart
    ? (gameMode === 'local' && players.length < 2 && humans.length >= 1 ? t('needTwo') : t('needName'))
    : t('botsWillFill');

  return (
    <div className="screen lobby">
      <div className="screen-inner lobby-inner">
        {/* Header */}
        <div className="lobby-header">
          <button className="btn btn-secondary btn-icon" onClick={goHome} aria-label={t('back')}>
            ‹
          </button>
          <h2 className="lobby-mode-title">
            {modeIcon} {modeTitle}
          </h2>
          <span className="lobby-header-spacer" />
        </div>

        {/* Name input */}
        <motion.div
          className="lobby-input-row"
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <input
            type="text"
            className="lobby-input"
            placeholder={t('yourName')}
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && canAddHuman && handleAddPlayer()}
            maxLength={16}
            disabled={players.length >= 4 || (gameMode === 'solo' && humans.length >= 1)}
          />
          <button
            className="btn btn-primary"
            onClick={handleAddPlayer}
            disabled={!canAddHuman}
          >
            ➕ {t('add')}
          </button>
        </motion.div>

        {/* Seats */}
        <div className={`lobby-seats ${gameMode === 'teams' ? 'lobby-seats--teams' : ''}`}>
          {gameMode === 'teams' && (
            <div className="lobby-team-labels">
              <span className="lobby-team-label" style={{ color: 'var(--color-red-light)' }}>
                🔥 {t('teamA')}
              </span>
              <span className="lobby-team-label" style={{ color: 'var(--color-green-light)' }}>
                🌿 {t('teamB')}
              </span>
            </div>
          )}
          <div className="lobby-seat-grid">
            {COLORS.map((color) => {
              const seated = playersByColor.get(color);
              const willBeBot = !seated;
              const isNextFree = color === nextFreeColor;

              return (
                <motion.div
                  key={color}
                  className={`lobby-seat ${seated ? 'lobby-seat--filled' : ''}`}
                  style={{ '--seat-color': PLAYER_CONFIG[color].cssColor } as React.CSSProperties}
                  layout
                >
                  <div className="lobby-seat-pawn">
                    <PawnSVG color={color} shadow={false} />
                  </div>
                  <div className="lobby-seat-info">
                    <AnimatePresence mode="wait">
                      {seated ? (
                        <motion.div
                          key="filled"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className="lobby-seat-player"
                        >
                          <span className="lobby-seat-name">
                            {seated.emoji} {seated.name}
                          </span>
                          <span className="lobby-seat-tag">
                            {seated.isBot ? `🤖 ${t('bot')}` : humans[0]?.id === seated.id ? `⭐ ${t('you')}` : PLAYER_CONFIG[color].label}
                          </span>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="empty"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="lobby-seat-player"
                        >
                          <span className="lobby-seat-name lobby-seat-name--ghost">
                            {willBeBot ? `${BOT_EMOJIS[color]} ${BOT_NAMES[color]}` : t('seatFree')}
                          </span>
                          <span className="lobby-seat-tag">🤖 {t('bot')}</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  {seated ? (
                    <button
                      className="lobby-seat-remove"
                      onClick={() => removePlayer(seated.id)}
                      aria-label="✕"
                    >
                      ✕
                    </button>
                  ) : (
                    isNextFree && gameMode !== 'solo' && (
                      <button
                        className="lobby-seat-add-bot"
                        onClick={addBotPlayer}
                        aria-label={t('addBot')}
                      >
                        +🤖
                      </button>
                    )
                  )}
                  {gameMode === 'teams' && (
                    <span
                      className="lobby-seat-team-dot"
                      style={{
                        background: (color === 'red' || color === 'yellow')
                          ? 'linear-gradient(135deg, var(--color-red), var(--color-yellow))'
                          : 'linear-gradient(135deg, var(--color-green), var(--color-blue))',
                      }}
                    >
                      {(color === 'red' || color === 'yellow') ? '🔥' : '🌿'}
                    </span>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {gameMode === 'teams' && (
          <p className="lobby-teams-note">
            {PLAYER_CONFIG.red.emoji}+{PLAYER_CONFIG.yellow.emoji} vs {PLAYER_CONFIG.green.emoji}+{PLAYER_CONFIG.blue.emoji} · 2v2
          </p>
        )}

        {/* Start */}
        <div className="lobby-actions">
          <motion.button
            className="btn btn-green lobby-start"
            disabled={!canStart}
            onClick={startGame}
            whileTap={canStart ? { scale: 0.96 } : {}}
          >
            🚀 {t('start')}
          </motion.button>
          <p className="lobby-hint">{hint}</p>
        </div>
      </div>

      <style>{`
        .lobby {
          justify-content: center;
        }
        .lobby-inner {
          gap: var(--gap-md);
          justify-content: center;
          max-width: 480px;
        }
        .lobby-header {
          display: flex;
          align-items: center;
          gap: var(--gap-sm);
        }
        .lobby-header .btn-icon {
          font-size: 1.6rem;
          line-height: 1;
        }
        .lobby-mode-title {
          flex: 1;
          text-align: center;
          font-family: var(--font-display);
          font-size: 1.35rem;
          font-weight: 800;
        }
        .lobby-header-spacer {
          width: 46px;
        }
        .lobby-input-row {
          display: flex;
          gap: var(--gap-sm);
        }
        .lobby-input {
          flex: 1;
          min-width: 0;
          padding: 12px 18px;
          border-radius: var(--radius-lg);
          border: 2px solid rgba(255, 255, 255, 0.25);
          background: rgba(255, 255, 255, 0.12);
          color: var(--color-text);
          font-family: var(--font-body);
          font-size: 1rem;
          font-weight: 700;
          outline: none;
          transition: border-color var(--transition-normal);
        }
        .lobby-input:focus {
          border-color: #ffd65a;
        }
        .lobby-input::placeholder {
          color: var(--color-text-muted);
        }
        .lobby-input:disabled {
          opacity: 0.5;
        }
        .lobby-team-labels {
          display: flex;
          justify-content: space-around;
          margin-bottom: 6px;
        }
        .lobby-team-label {
          font-family: var(--font-display);
          font-size: 0.8rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .lobby-seat-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
        }
        .lobby-seat {
          position: relative;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          border-radius: var(--radius-xl);
          background: rgba(255, 255, 255, 0.08);
          border: 2px solid rgba(255, 255, 255, 0.12);
          transition: border-color var(--transition-normal), background var(--transition-normal);
        }
        .lobby-seat--filled {
          background: rgba(255, 255, 255, 0.14);
          border-color: var(--seat-color);
          box-shadow: 0 0 14px color-mix(in srgb, var(--seat-color) 40%, transparent);
        }
        .lobby-seat-pawn {
          width: 34px;
          flex-shrink: 0;
        }
        .lobby-seat-pawn svg {
          width: 100%;
          height: auto;
          display: block;
        }
        .lobby-seat-info {
          flex: 1;
          min-width: 0;
        }
        .lobby-seat-player {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }
        .lobby-seat-name {
          font-family: var(--font-display);
          font-weight: 800;
          font-size: 1rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .lobby-seat-name--ghost {
          opacity: 0.55;
        }
        .lobby-seat-tag {
          font-size: 0.72rem;
          font-weight: 800;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .lobby-seat-remove {
          width: 32px;
          height: 32px;
          flex-shrink: 0;
          border-radius: 50%;
          border: none;
          background: rgba(255, 255, 255, 0.14);
          color: var(--color-text-secondary);
          cursor: pointer;
          font-size: 0.8rem;
          font-weight: 800;
          transition: background var(--transition-fast);
        }
        .lobby-seat-remove:hover {
          background: var(--color-red);
          color: #fff;
        }
        .lobby-seat-add-bot {
          flex-shrink: 0;
          padding: 6px 12px;
          border-radius: var(--radius-full);
          border: 2px dashed rgba(255, 255, 255, 0.3);
          background: transparent;
          color: var(--color-text-secondary);
          font-weight: 800;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .lobby-seat-add-bot:hover {
          background: rgba(255, 255, 255, 0.12);
          border-style: solid;
        }
        .lobby-seat-team-dot {
          position: absolute;
          top: -7px;
          left: 14px;
          font-size: 0.7rem;
          padding: 1px 7px;
          border-radius: var(--radius-full);
          border: 2px solid rgba(255, 255, 255, 0.6);
          line-height: 1.2;
        }
        .lobby-teams-note {
          text-align: center;
          font-size: 0.85rem;
          color: var(--color-text-secondary);
          font-weight: 700;
        }
        .lobby-actions {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          margin-top: 4px;
        }
        .lobby-start {
          width: 100%;
          font-size: 1.25rem;
          min-height: 58px;
        }
        .lobby-hint {
          font-size: 0.8rem;
          color: var(--color-text-muted);
          font-weight: 700;
          text-align: center;
        }
      `}</style>
    </div>
  );
}
