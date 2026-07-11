import { AnimatePresence, motion } from 'framer-motion';
import { LUCKY_DICE_COST } from '../game/gameEngine.ts';
import { PIP_MAP } from './Dice3D.tsx';
import { playSfx } from '../sound.ts';
import { useT } from '../i18n.ts';

/**
 * Lucky-dice shop (Ludo Club style, but with earned points instead of
 * bought money): players earn 1 ⭐ per natural 6 or 1 rolled, and spend
 * them here on a weighted dice — 50% chance the roll IS the chosen
 * number, 50% it lands one of the two numbers below it.
 */

interface DiceShopProps {
  isOpen: boolean;
  points: number;
  /** Only true when the local player may roll right now — purchases roll immediately. */
  canBuy: boolean;
  onClose: () => void;
  onBuy: (n: number) => void;
}

const SHOP_NUMBERS = [1, 2, 3, 4, 5, 6];

function ShopDieFace({ value }: { value: number }) {
  const pips = PIP_MAP[value];
  return (
    <div className="dice-shop-face">
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={pips.includes(i) ? 'ds-pip' : 'ds-pip ds-pip--off'} />
      ))}
    </div>
  );
}

export default function DiceShop({ isOpen, points, canBuy, onClose, onBuy }: DiceShopProps) {
  const t = useT();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="dice-shop-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="dice-shop"
            initial={{ y: 40, scale: 0.92, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 40, scale: 0.92, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dice-shop-header">
              <span className="dice-shop-title">🎲 {t('luckyTitle')}</span>
              <span className="dice-shop-points">⭐ {points}</span>
              <button className="dice-shop-close" onClick={onClose} aria-label="✕">✕</button>
            </div>

            <p className="dice-shop-hint">{t('luckyHint')}</p>

            <div className="dice-shop-grid">
              {SHOP_NUMBERS.map((n) => {
                const cost = LUCKY_DICE_COST[n];
                const affordable = points >= cost;
                const enabled = canBuy && affordable;
                return (
                  <button
                    key={n}
                    className={`dice-shop-item ${enabled ? '' : 'dice-shop-item--locked'}`}
                    disabled={!enabled}
                    onClick={() => {
                      playSfx('pop');
                      onBuy(n);
                      onClose();
                    }}
                  >
                    <ShopDieFace value={n} />
                    <span className={`dice-shop-cost ${affordable ? '' : 'dice-shop-cost--missing'}`}>
                      ⭐ {cost}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="dice-shop-earn">{t('luckyEarn')}</p>
          </motion.div>

          <style>{`
            .dice-shop-backdrop {
              position: fixed;
              inset: 0;
              z-index: 90;
              background: rgba(12, 5, 40, 0.55);
              display: flex;
              align-items: flex-end;
              justify-content: center;
              padding: 16px;
            }
            .dice-shop {
              width: 100%;
              max-width: 420px;
              margin-bottom: max(70px, env(safe-area-inset-bottom));
              border-radius: 22px;
              background: linear-gradient(165deg, #3d2b8f, #241865);
              border: 2px solid rgba(255, 214, 90, 0.45);
              box-shadow: 0 18px 50px rgba(8, 2, 30, 0.6);
              padding: 14px 16px 12px;
              display: flex;
              flex-direction: column;
              gap: 10px;
            }
            .dice-shop-header {
              display: flex;
              align-items: center;
              gap: 10px;
            }
            .dice-shop-title {
              flex: 1;
              font-family: var(--font-display);
              font-size: 1.05rem;
              font-weight: 800;
            }
            .dice-shop-points {
              font-family: var(--font-display);
              font-weight: 800;
              font-size: 0.95rem;
              color: #ffd65a;
              background: rgba(255, 214, 90, 0.14);
              border: 1px solid rgba(255, 214, 90, 0.4);
              padding: 3px 10px;
              border-radius: var(--radius-full);
            }
            .dice-shop-close {
              width: 30px;
              height: 30px;
              border-radius: 50%;
              border: none;
              background: rgba(255, 255, 255, 0.14);
              color: var(--color-text-secondary);
              font-weight: 800;
              cursor: pointer;
            }
            .dice-shop-hint {
              font-size: 0.78rem;
              font-weight: 700;
              color: var(--color-text-secondary);
              line-height: 1.35;
            }
            .dice-shop-grid {
              display: grid;
              grid-template-columns: repeat(6, 1fr);
              gap: 6px;
            }
            .dice-shop-item {
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 6px;
              padding: 8px 4px;
              border-radius: 14px;
              border: 2px solid rgba(255, 214, 90, 0.5);
              background: rgba(255, 255, 255, 0.08);
              cursor: pointer;
              transition: transform var(--transition-fast), background var(--transition-fast);
              touch-action: manipulation;
            }
            .dice-shop-item:not(:disabled):hover {
              background: rgba(255, 214, 90, 0.16);
              transform: translateY(-3px);
            }
            .dice-shop-item--locked {
              opacity: 0.45;
              border-color: rgba(255, 255, 255, 0.15);
              cursor: default;
            }
            .dice-shop-face {
              width: 100%;
              max-width: 46px;
              aspect-ratio: 1;
              border-radius: 20%;
              background: radial-gradient(circle at 30% 25%, #ffffff 0%, #f3eee2 55%, #ddd3bd 100%);
              border: 1px solid rgba(120, 100, 60, 0.3);
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              grid-template-rows: repeat(3, 1fr);
              place-items: center;
              padding: 14%;
            }
            .ds-pip {
              width: 70%;
              height: 70%;
              border-radius: 50%;
              background: radial-gradient(circle at 35% 30%, #6b5cf0 0%, #4534b8 70%, #32247e 100%);
            }
            .ds-pip--off { visibility: hidden; }
            .dice-shop-cost {
              font-family: var(--font-display);
              font-size: 0.78rem;
              font-weight: 800;
              color: #ffd65a;
            }
            .dice-shop-cost--missing {
              color: var(--color-text-muted);
            }
            .dice-shop-earn {
              text-align: center;
              font-size: 0.74rem;
              font-weight: 700;
              color: var(--color-text-muted);
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
