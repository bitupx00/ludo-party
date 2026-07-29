import { useState } from 'react';
import { motion } from 'framer-motion';
import { ensureProfile, importProfileCode, type PlayerProfile } from '../profile.ts';
import { styleOnce } from '../styleOnce.ts';
import { AlertTriangle, Coins, KeyRound, ShieldCheck, UserPlus } from 'lucide-react';

/**
 * Mandatory registration: shown on the home screen whenever the device
 * has NO profile. It cannot be dismissed — the player either creates an
 * account (name → id + PIN + 3,000 starting puntos, all persisted) or
 * restores an existing one with their transfer code + PIN.
 */
export default function RegisterModal({ onDone }: { onDone: (profile: PlayerProfile) => void }) {
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'create' | 'restore'>('create');
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [restoreBad, setRestoreBad] = useState(false);

  const canCreate = name.trim().length >= 2;

  const handleCreate = () => {
    if (!canCreate) return;
    onDone(ensureProfile(name));
  };

  const handleRestore = () => {
    const restored = importProfileCode(code, pin);
    if (restored) onDone(restored);
    else setRestoreBad(true);
  };

  return (
    <div className="reg-backdrop">
      <motion.div
        className="reg-modal"
        initial={{ scale: 0.9, y: 18, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      >
        <img className="reg-logo" src="/logo.webp" alt="LudoPata'S" draggable={false} />

        {mode === 'create' ? (
          <>
            <h2 className="reg-title"><UserPlus size={17} className="reg-ico" /> Crea tu cuenta</h2>
            <p className="reg-sub">
              Tu cuenta guarda tu nombre, tus <b>puntos</b>, tus <b>estrellas</b> y todo
              lo que compres — para siempre en este dispositivo.
            </p>
            <input
              className="reg-input"
              type="text"
              placeholder="Tu nombre de jugador…"
              value={name}
              maxLength={24}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <button className="btn btn-primary reg-btn" disabled={!canCreate} onClick={handleCreate}>
              Crear cuenta y recibir el bono
            </button>
            <p className="reg-bonus">
              <Coins size={13} className="reg-ico" /> Bono de bienvenida: <b>10.000 puntos</b> + <b>100 estrellas</b> + recompensa diaria
            </p>
            <p className="reg-note">
              <ShieldCheck size={12} className="reg-ico" /> Al crearla se genera tu ID y tu PIN
              (míralos en "Mi perfil") para llevar la cuenta a otro dispositivo.
            </p>
            <button className="reg-switch" onClick={() => setMode('restore')}>
              ¿Ya tienes cuenta? Recupérala con tu código
            </button>
          </>
        ) : (
          <>
            <h2 className="reg-title"><KeyRound size={17} className="reg-ico" /> Recuperar cuenta</h2>
            <p className="reg-sub">Pega el código de tu perfil anterior y su PIN de 4 dígitos.</p>
            <input
              className="reg-input"
              type="text"
              placeholder="Código LP1…"
              value={code}
              onChange={(e) => { setCode(e.target.value); setRestoreBad(false); }}
            />
            <input
              className="reg-input"
              type="tel"
              placeholder="PIN (4 dígitos)"
              value={pin}
              maxLength={4}
              onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setRestoreBad(false); }}
              onKeyDown={(e) => e.key === 'Enter' && handleRestore()}
            />
            {restoreBad && (
              <p className="reg-bad"><AlertTriangle size={12} className="reg-ico" /> Código o PIN incorrecto</p>
            )}
            <button
              className="btn btn-green reg-btn"
              disabled={!code.trim().startsWith('LP1') || pin.length !== 4}
              onClick={handleRestore}
            >
              Recuperar mi cuenta
            </button>
            <button className="reg-switch" onClick={() => setMode('create')}>
              ‹ Volver a crear cuenta nueva
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}

styleOnce('register-modal', `
  .reg-backdrop {
    position: fixed; inset: 0; z-index: 120;
    background: rgba(10, 4, 36, 0.8);
    backdrop-filter: blur(6px);
    display: flex; align-items: center; justify-content: center;
    padding: 18px;
  }
  .reg-modal {
    width: min(400px, 100%);
    max-height: 92svh;
    overflow-y: auto;
    background: linear-gradient(168deg, #3d2b8f, #221562);
    border: 2px solid rgba(255, 214, 90, 0.55);
    border-radius: 24px;
    padding: 22px 20px;
    display: flex; flex-direction: column; align-items: center; gap: 11px;
    box-shadow: 0 24px 60px rgba(8, 2, 30, 0.7);
    text-align: center;
  }
  .reg-logo {
    width: 92px; aspect-ratio: 1;
    border-radius: 20px;
    border: 2.5px solid rgba(255, 214, 90, 0.6);
    box-shadow: 0 8px 20px rgba(18, 8, 60, 0.5);
    user-select: none; -webkit-user-drag: none;
  }
  .reg-title { font-family: var(--font-display); font-size: 1.2rem; font-weight: 800; }
  .reg-ico { vertical-align: -2px; display: inline; }
  .reg-sub { font-size: 0.82rem; line-height: 1.45; color: var(--color-text-secondary); font-weight: 700; }
  .reg-sub b { color: #ffd65a; }
  .reg-input {
    width: 100%;
    padding: 12px 16px;
    border-radius: var(--radius-full);
    border: 2px solid rgba(255, 255, 255, 0.22);
    background: rgba(255, 255, 255, 0.1);
    color: var(--color-text);
    font-family: var(--font-body);
    font-size: 0.95rem;
    font-weight: 700;
    outline: none;
    text-align: center;
  }
  .reg-input:focus { border-color: #ffd65a; }
  .reg-input::placeholder { color: var(--color-text-muted); }
  .reg-btn { width: 100%; padding: 13px 0; font-size: 0.95rem; }
  .reg-btn:disabled { opacity: 0.45; }
  .reg-bonus {
    font-family: var(--font-display);
    font-size: 0.8rem; font-weight: 800;
    color: #ffd65a;
    background: rgba(255, 214, 90, 0.12);
    border: 1.5px solid rgba(255, 214, 90, 0.4);
    border-radius: var(--radius-full);
    padding: 7px 14px;
  }
  .reg-bonus b { color: #ffe9a8; }
  .reg-note { font-size: 0.7rem; font-weight: 700; color: var(--color-text-muted); line-height: 1.4; }
  .reg-bad { font-size: 0.78rem; font-weight: 800; color: #ffb0bb; }
  .reg-switch {
    border: none; background: transparent;
    color: var(--color-text-secondary);
    font-size: 0.78rem; font-weight: 800;
    text-decoration: underline;
    cursor: pointer;
    padding: 4px;
  }
`);
