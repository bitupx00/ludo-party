import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { styleOnce } from '../styleOnce.ts';
import type { LucideIcon } from 'lucide-react';
import {
  Backpack, Coins, Dices, Gamepad2, Gift, Hand, Home as HomeIcon, Target,
  Trophy, Volume2,
} from 'lucide-react';

/** Interactive guided manual: one screenshot per feature, next/back
 *  navigation, progress bar, swipe + keyboard support. Screenshots live
 *  in /public/tutorial (captured from the real game at mobile size). */

interface Step {
  img: string;
  Icon: LucideIcon;
  title: string;
  /** Short guided paragraphs; **bold** segments are highlighted. */
  body: string[];
  tip?: string;
}

const STEPS: Step[] = [
  {
    img: '01-home',
    Icon: HomeIcon,
    title: 'Bienvenido a LudoPata’S',
    body: [
      'Esta es tu **pantalla de inicio**. Arriba a la izquierda ves tu perfil con tus **estrellas** (empiezas con **100**) y tus **puntos** (empiezas con **10.000**).',
      'Los botones de la derecha son: **Ranking** (trofeo), **Recompensa diaria** (regalo), **este tutorial**, **Inventario** (mochila) y **Arcade** (mando).',
      'Elige un modo para jugar: **Online**, **vs Bots**, **Pasar y Jugar** o **Equipos 2v2**.',
    ],
    tip: 'Empieza con "Jugar vs Bots" para practicar sin apostar mucho.',
  },
  {
    img: '02-diaria',
    Icon: Gift,
    title: 'Recompensa diaria',
    body: [
      'Entra **todos los días** y toca el botón del **regalo** para reclamar puntos gratis.',
      'La **racha semanal** sube el premio cada día: desde **1.000 puntos** hasta **30.000 puntos + 100 estrellas** el día 7.',
      'Si faltas un día, la racha vuelve a empezar. ¡No te lo pierdas!',
    ],
  },
  {
    img: '03-lobby',
    Icon: Coins,
    title: 'La sala y la apuesta',
    body: [
      'Antes de jugar eliges la **apuesta de la partida**: de **100 a 3.000 puntos** de entrada.',
      'Todos los jugadores pagan la entrada y **el ganador se lleva el pozo completo**.',
      'Aquí también activas el modo **Piezas Hermanas**: tus fichas apiladas en la misma casilla se mueven juntas como convoy.',
    ],
    tip: 'En Equipos 2v2 el pozo se reparte entre los dos ganadores.',
  },
  {
    img: '04-partida',
    Icon: Dices,
    title: 'Tu turno: ¡tira el dado!',
    body: [
      'Cuando el marco se ilumina con tu color, **es tu turno**: toca el **dado** para lanzar.',
      'Sacas fichas de casa con **6 o con 1**. El 6 y el 1 también dan **tiro extra**.',
      'Tienes **20 segundos** por turno (mira la barrita sobre tu avatar). Si no juegas, el juego tira y mueve por ti.',
    ],
    tip: '¡Matar una ficha con un 6 o un 1 te da DOBLE tiro extra!',
  },
  {
    img: '05-mover',
    Icon: Hand,
    title: 'Mueve tus fichas',
    body: [
      'Tras lanzar, las fichas que **pueden moverse brillan con un anillo**: toca la que quieras avanzar.',
      'Da la vuelta completa al tablero y entra a tu **pasillo de color** hasta la meta central (necesitas el número exacto).',
      'Las casillas con **estrella son seguras**: ahí nadie puede comerte. Si caes sobre un rival fuera de una segura, ¡lo mandas a casa!',
    ],
    tip: 'Tres tiros extra seguidos cancelan la jugada — no abuses del 6.',
  },
  {
    img: '06-tienda',
    Icon: Target,
    title: 'Dado de la suerte',
    body: [
      'Gana **1 estrella por cada 6 o 1** que saques. Toca el botón de la **diana** para abrir la tienda.',
      'Compra un dado y queda **ARMADO** para tu próxima tirada: **50% de que salga tu número**.',
      'Cada compra sube **+1 estrella** el precio de todos los dados. ¿Te arrepentiste? Tócalo otra vez y se **cancela con reembolso**.',
    ],
  },
  {
    img: '07-sonidos',
    Icon: Volume2,
    title: 'Sonidos y reacciones',
    body: [
      'Tu barra rápida muestra **TUS memes comprados**: toca uno y todos lo ven con su **sonido** (máx. 1 por turno).',
      'En el panel **+** están **Mis memes** y las **Frases** rápidas. Solo puedes usar memes que hayas **comprado en el Inventario**.',
      '¿Alguien es muy ruidoso? Silencia a cualquier jugador con el **altavoz de su avatar**.',
    ],
    tip: 'Vincula un sonido a cada meme en el Inventario para personalizar tu arsenal.',
  },
  {
    img: '08-lanzar',
    Icon: Gift,
    title: '¡Lánzale memes a tus rivales!',
    body: [
      'Toca el **regalo en el avatar de un rival** y elige cuál de **tus memes** lanzarle.',
      'El meme **vuela por la pantalla**, suena al impactar y se le queda **pegado 1 minuto** en su avatar.',
      'Cuenta como tu sonido del turno: **1 lanzamiento por turno**.',
    ],
  },
  {
    img: '09-inventario',
    Icon: Backpack,
    title: 'Tu inventario',
    body: [
      'En el **Inventario** compras y equipas tu **modelo de dado**: 8 diseños vectorizados de **3.000 a 40.000 puntos** según su categoría.',
      'También **compras memes** (30 nuevos cada día + buscador) por **3.500 puntos** y les **vinculas un sonido** por 15 estrellas.',
      'Pronto: fichas y tableros personalizados.',
    ],
  },
  {
    img: '10-arcade',
    Icon: Gamepad2,
    title: 'Arcade: gana puntos jugando',
    body: [
      'En el **Arcade** tienes **8 puzzles** y **8 minijuegos** distintos, cada uno en **3 dificultades**.',
      'A más dificultad, **mayor premio** (multiplicador ×1/×2/×3). Límite diario: **10 + 10 partidas**.',
      'Los puzzles premian con **estrellas o miles de puntos redondos**; los minijuegos siempre dan puntos.',
    ],
    tip: 'Es la forma más rápida de juntar puntos para apuestas altas.',
  },
  {
    img: '11-ranking',
    Icon: Trophy,
    title: 'Ranking y equipos',
    body: [
      'El **Ranking** guarda tus victorias, capturas y fichas coronadas en este dispositivo.',
      'En **Equipos 2v2**: Fuego (rojo+amarillo) vs Bosque (verde+azul). Ganan cuando **las 8 fichas del equipo** llegan a la meta.',
      'Si terminas primero, **sigues jugando moviendo las fichas de tu aliado**. ¡A jugar!',
    ],
  },
];

/** Render **bold** markers inside guided text. */
function rich(text: string) {
  const parts = text.split('**');
  return parts.map((p, i) => (i % 2 === 1 ? <b key={i}>{p}</b> : <span key={i}>{p}</span>));
}

export const TUTORIAL_SEEN_KEY = 'ludo-party-tutorial-seen';

export default function TutorialModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const touchX = useRef<number | null>(null);
  const total = STEPS.length;
  const s = STEPS[step];

  const go = useCallback((next: number) => {
    if (next < 0 || next >= total) return;
    setDir(next > step ? 1 : -1);
    setStep(next);
  }, [step, total]);

  const finish = useCallback(() => {
    try { localStorage.setItem(TUTORIAL_SEEN_KEY, '1'); } catch { /* private mode */ }
    onClose();
  }, [onClose]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(step + 1);
      else if (e.key === 'ArrowLeft') go(step - 1);
      else if (e.key === 'Escape') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, step, finish]);

  // Preload the next screenshot so advancing feels instant
  useEffect(() => {
    const next = STEPS[step + 1];
    if (next) { const im = new Image(); im.src = `/tutorial/${next.img}.webp`; }
  }, [step]);

  return (
    <div className="tut-backdrop" onClick={finish}>
      <div className="tut-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="tut-head">
          <span className="tut-step-chip">{step + 1} / {total}</span>
          <span className="tut-title"><s.Icon size={16} className="tut-title-ico" /> {s.title}</span>
          <button className="tut-close" onClick={finish} aria-label="Cerrar">✕</button>
        </div>

        {/* Progress bar */}
        <div className="tut-progress">
          <div className="tut-progress-fill" style={{ width: `${((step + 1) / total) * 100}%` }} />
        </div>

        {/* Slide */}
        <div
          className="tut-body"
          onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            if (touchX.current == null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            touchX.current = null;
            if (dx < -48) go(step + 1);
            else if (dx > 48) go(step - 1);
          }}
        >
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step}
              className="tut-slide"
              custom={dir}
              initial={{ x: dir * 46, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: dir * -46, opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              <div className="tut-shot-frame">
                <img className="tut-shot" src={`/tutorial/${s.img}.webp`} alt={s.title} draggable={false} />
              </div>
              <div className="tut-text">
                {s.body.map((p, i) => <p key={i}>{rich(p)}</p>)}
                {s.tip && <p className="tut-tip">{rich(s.tip)}</p>}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Dots */}
        <div className="tut-dots">
          {STEPS.map((_, i) => (
            <button
              key={i}
              className={`tut-dot ${i === step ? 'tut-dot--on' : ''}`}
              onClick={() => go(i)}
              aria-label={`Paso ${i + 1}`}
            />
          ))}
        </div>

        {/* Nav buttons */}
        <div className="tut-nav">
          <button className="btn btn-secondary tut-nav-btn" onClick={() => go(step - 1)} disabled={step === 0}>
            ‹ Anterior
          </button>
          {step < total - 1 ? (
            <button className="btn btn-primary tut-nav-btn" onClick={() => go(step + 1)}>
              Siguiente ›
            </button>
          ) : (
            <button className="btn btn-green tut-nav-btn" onClick={finish}>
              ¡A jugar!
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

styleOnce('tutorial-modal', `
  .tut-backdrop {
    position: fixed; inset: 0; z-index: 95;
    background: rgba(10, 4, 36, 0.72);
    backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
    padding: max(10px, env(safe-area-inset-top)) 12px max(10px, env(safe-area-inset-bottom));
  }
  .tut-modal {
    width: min(430px, 100%);
    max-height: min(94svh, 820px);
    display: flex; flex-direction: column;
    background: linear-gradient(168deg, #3d2b8f, #221562);
    border: 2px solid rgba(255, 214, 90, 0.5);
    border-radius: 24px;
    padding: 14px 14px 12px;
    box-shadow: 0 24px 60px rgba(8, 2, 30, 0.65);
    overflow: hidden;
  }
  .tut-head {
    display: flex; align-items: center; gap: 10px;
    padding-bottom: 10px;
  }
  .tut-step-chip {
    flex-shrink: 0;
    font-family: var(--font-display);
    font-size: 0.72rem; font-weight: 800;
    color: #ffd65a;
    background: rgba(255, 214, 90, 0.14);
    border: 1.5px solid rgba(255, 214, 90, 0.45);
    border-radius: var(--radius-full);
    padding: 4px 9px;
  }
  .tut-title-ico { vertical-align: -2px; margin-right: 2px; display: inline; color: #ffd65a; }
  .tut-title {
    flex: 1; min-width: 0;
    font-family: var(--font-display);
    font-size: 0.9rem; font-weight: 800;
    line-height: 1.15;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .tut-close {
    flex-shrink: 0;
    width: 34px; height: 34px;
    border-radius: var(--radius-full);
    border: 2px solid rgba(255, 255, 255, 0.22);
    background: rgba(255, 255, 255, 0.1);
    color: var(--color-text);
    font-size: 0.95rem; font-weight: 800;
    cursor: pointer;
  }
  .tut-progress {
    height: 6px; border-radius: 3px;
    background: rgba(255, 255, 255, 0.12);
    overflow: hidden;
    margin-bottom: 10px;
  }
  .tut-progress-fill {
    height: 100%;
    border-radius: 3px;
    background: linear-gradient(90deg, #ffd65a, #f5a415);
    transition: width 260ms ease;
  }
  .tut-body { flex: 1; min-height: 0; overflow: hidden; touch-action: pan-y; }
  .tut-slide {
    height: 100%;
    display: flex; flex-direction: column; gap: 10px;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
  .tut-shot-frame {
    flex-shrink: 0;
    align-self: center;
    width: min(56%, 206px);
    border-radius: 18px;
    border: 2.5px solid rgba(255, 255, 255, 0.28);
    box-shadow: 0 10px 26px rgba(8, 2, 30, 0.5), inset 0 0 0 1px rgba(0,0,0,0.3);
    overflow: hidden;
    background: #241865;
  }
  .tut-shot { display: block; width: 100%; height: auto; user-select: none; -webkit-user-drag: none; }
  .tut-text {
    display: flex; flex-direction: column; gap: 7px;
    font-size: 0.82rem; line-height: 1.45;
    color: var(--color-text-secondary);
    padding: 0 2px 4px;
  }
  .tut-text b { color: var(--color-text); }
  .tut-tip {
    font-size: 0.76rem; font-weight: 700;
    color: #ffe9a8;
    background: rgba(255, 214, 90, 0.12);
    border: 1.5px solid rgba(255, 214, 90, 0.35);
    border-radius: 12px;
    padding: 7px 10px;
  }
  .tut-dots {
    display: flex; justify-content: center; gap: 6px;
    padding: 10px 0 8px;
  }
  .tut-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    border: none; padding: 0;
    background: rgba(255, 255, 255, 0.25);
    cursor: pointer;
    transition: transform 150ms ease, background 150ms ease;
  }
  .tut-dot--on { background: #ffd65a; transform: scale(1.35); }
  .tut-nav { display: flex; gap: 10px; }
  .tut-nav-btn { flex: 1; padding: 11px 0; font-size: 0.9rem; }
  .tut-nav-btn:disabled { opacity: 0.45; }

  @media (min-width: 560px) {
    .tut-slide { flex-direction: row; align-items: flex-start; }
    .tut-shot-frame { width: 44%; }
    .tut-text { flex: 1; padding-top: 4px; }
  }
`);
