import { motion } from 'framer-motion';
import type { Player } from '../game/types.ts';
import { PLAYER_CONFIG } from '../game/types.ts';

interface PlayerPanelProps {
  players: Player[];
  currentPlayerIndex: number;
}

export default function PlayerPanel({ players, currentPlayerIndex }: PlayerPanelProps) {
  const getPlayerStats = (player: Player) => {
    return {
      home: player.pieces.filter(p => p.position === -1).length,
      active: player.pieces.filter(p => p.position >= 0 && p.position < 56).length,
      finished: player.pieces.filter(p => p.position === 56).length,
    };
  };

  return (
    <div className="player-panel glass">
      <div className="player-panel-inner">
        {players.map((player, index) => {
          const stats = getPlayerStats(player);
          const config = PLAYER_CONFIG[player.color];
          const isCurrent = index === currentPlayerIndex;

          return (
            <motion.div
              key={player.id}
              className={`panel-player ${isCurrent ? 'panel-player--active' : ''}`}
              style={{
                '--player-color': config.cssColor,
                '--player-glow': config.cssColor + '66',
              } as React.CSSProperties}
              animate={isCurrent ? {
                scale: [1, 1.02, 1],
              } : {}}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              <div className="panel-player-avatar" style={{ background: config.cssColor }}>
                {config.emoji}
              </div>
              <div className="panel-player-info">
                <span className="panel-player-name">
                  {player.name}
                  {player.isBot && <span className="panel-bot-badge">🤖</span>}
                </span>
                <div className="panel-player-stats">
                  <span className="stat" title="En base">🏠{stats.home}</span>
                  <span className="stat" title="Activas">🎮{stats.active}</span>
                  <span className="stat" title="Metidas">🏁{stats.finished}</span>
                </div>
              </div>
              {isCurrent && (
                <motion.div
                  className="panel-player-turn"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  style={{ color: config.cssColor }}
                >
                  ▶
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>

      <style>{`
        .player-panel {
          padding: var(--gap-sm) var(--gap-md);
          overflow-x: auto;
          flex-shrink: 0;
        }
        .player-panel-inner {
          display: flex;
          gap: var(--gap-sm);
          min-width: max-content;
        }
        .panel-player {
          display: flex;
          align-items: center;
          gap: var(--gap-sm);
          padding: 6px 12px;
          border-radius: var(--radius-full);
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid transparent;
          transition: all var(--transition-normal);
          white-space: nowrap;
        }
        .panel-player--active {
          background: rgba(255, 255, 255, 0.08);
          border-color: var(--player-color);
          box-shadow: 0 0 12px var(--player-glow);
        }
        .panel-player-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.9rem;
          flex-shrink: 0;
        }
        .panel-player-info {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }
        .panel-player-name {
          font-size: 0.75rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .panel-bot-badge {
          font-size: 0.65rem;
        }
        .panel-player-stats {
          display: flex;
          gap: 6px;
          font-size: 0.65rem;
          color: var(--color-text-muted);
        }
        .panel-player-turn {
          font-size: 0.8rem;
          animation: pulse-glow 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
