import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore.ts';
import { useRankStore, sortRanking } from '../ranking.ts';
import { useT } from '../i18n.ts';

/** Device-local player leaderboard: wins, games, kills and goals for
 *  everyone who has played on this device (plus your online results). */
export default function RankingScreen() {
  const t = useT();
  const goHome = useGameStore((s) => s.goHome);
  const entries = useRankStore((s) => s.entries);
  const ranked = sortRanking(entries);

  const medal = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`);

  return (
    <div className="screen ranking">
      <div className="screen-inner ranking-inner">
        <div className="ranking-header">
          <button className="ranking-back" onClick={goHome} aria-label={t('mainMenu')}>‹</button>
          <h1 className="ranking-title">🏆 {t('ranking')}</h1>
        </div>

        {ranked.length === 0 ? (
          <motion.p
            className="ranking-empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {t('rankingEmpty')}
          </motion.p>
        ) : (
          <div className="ranking-table">
            <div className="ranking-row ranking-row--head">
              <span className="rk-pos">#</span>
              <span className="rk-name">{t('rankPlayer')}</span>
              <span className="rk-stat" title={t('rankWins')}>🏆</span>
              <span className="rk-stat" title={t('rankGames')}>🎮</span>
              <span className="rk-stat" title={t('rankKills')}>💥</span>
              <span className="rk-stat" title={t('rankGoals')}>🏁</span>
            </div>
            {ranked.map((e, i) => (
              <motion.div
                key={e.name.toLowerCase()}
                className={`ranking-row ${i === 0 ? 'ranking-row--top' : ''}`}
                initial={{ x: -24, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: Math.min(i * 0.05, 0.5) }}
              >
                <span className="rk-pos">{medal(i)}</span>
                <span className="rk-name">
                  {e.name}
                  <span className="rk-rate">
                    {e.games > 0 ? `${Math.round((e.wins / e.games) * 100)}%` : '—'}
                  </span>
                </span>
                <span className="rk-stat rk-stat--wins">{e.wins}</span>
                <span className="rk-stat">{e.games}</span>
                <span className="rk-stat">{e.kills}</span>
                <span className="rk-stat">{e.goals}</span>
              </motion.div>
            ))}
          </div>
        )}

        <p className="ranking-note">{t('rankingNote')}</p>
      </div>

      <style>{`
        .ranking-inner {
          max-width: 480px;
          gap: var(--gap-md);
          padding-top: calc(14px + env(safe-area-inset-top));
        }
        .ranking-header {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .ranking-back {
          width: 40px;
          height: 40px;
          flex-shrink: 0;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.22);
          background: rgba(255, 255, 255, 0.1);
          color: var(--color-text);
          font-size: 1.5rem;
          line-height: 1;
          cursor: pointer;
        }
        .ranking-title {
          font-family: var(--font-display);
          font-size: 1.5rem;
          font-weight: 800;
        }
        .ranking-empty {
          text-align: center;
          padding: 40px 20px;
          font-weight: 700;
          color: var(--color-text-secondary);
          background: rgba(255, 255, 255, 0.08);
          border-radius: var(--radius-xl);
        }
        .ranking-table {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .ranking-row {
          display: grid;
          grid-template-columns: 34px 1fr 40px 40px 40px 40px;
          align-items: center;
          gap: 4px;
          padding: 10px 12px;
          border-radius: var(--radius-lg);
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.12);
        }
        .ranking-row--head {
          background: transparent;
          border: none;
          padding-top: 0;
          padding-bottom: 0;
          font-size: 0.8rem;
          color: var(--color-text-muted);
        }
        .ranking-row--top {
          background: rgba(255, 214, 90, 0.14);
          border-color: rgba(255, 214, 90, 0.45);
        }
        .rk-pos {
          font-family: var(--font-display);
          font-weight: 800;
          font-size: 0.95rem;
          text-align: center;
        }
        .rk-name {
          font-family: var(--font-display);
          font-weight: 800;
          font-size: 0.92rem;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          display: flex;
          align-items: baseline;
          gap: 8px;
        }
        .rk-rate {
          font-size: 0.68rem;
          color: var(--color-text-muted);
          font-weight: 700;
        }
        .rk-stat {
          text-align: center;
          font-weight: 800;
          font-size: 0.88rem;
          color: var(--color-text-secondary);
        }
        .rk-stat--wins {
          color: #ffd65a;
        }
        .ranking-note {
          text-align: center;
          font-size: 0.72rem;
          font-weight: 700;
          color: var(--color-text-muted);
        }
      `}</style>
    </div>
  );
}
