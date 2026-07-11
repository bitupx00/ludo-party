import { useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  loadProfile,
  exportProfileCode,
  importProfileCode,
  type PlayerProfile,
} from '../profile.ts';
import { useT } from '../i18n.ts';

/**
 * Player profile badge (home screen) + modal: shows the local "account"
 * (name, accumulated ⭐, public ID), with one-click copies of the ID, the
 * secret PIN and the full transfer code, plus a restore form to bring a
 * profile over from another device (new IP/phone → paste code + PIN).
 */

function CopyRow({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(!secret);

  const copy = useCallback(async () => {
    try { await navigator.clipboard.writeText(value); } catch { /* noop */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }, [value]);

  return (
    <div className="profile-row">
      <span className="profile-row-label">{label}</span>
      <span className="profile-row-value" onClick={() => secret && setRevealed(!revealed)}>
        {revealed ? value : '••••'}
      </span>
      <button className="profile-row-copy" onClick={copy}>
        {copied ? `✅ ${t('copiedCode')}` : `📋 ${t('copyCode')}`}
      </button>
    </div>
  );
}

export default function ProfileCard() {
  const t = useT();
  const [profile, setProfile] = useState<PlayerProfile | null>(loadProfile);
  const [open, setOpen] = useState(false);
  const [restoreCode, setRestoreCode] = useState('');
  const [restorePin, setRestorePin] = useState('');
  const [restoreState, setRestoreState] = useState<'idle' | 'ok' | 'bad'>('idle');

  const handleRestore = useCallback(() => {
    const restored = importProfileCode(restoreCode, restorePin);
    if (restored) {
      setProfile(restored);
      setRestoreState('ok');
      setRestoreCode('');
      setRestorePin('');
    } else {
      setRestoreState('bad');
    }
    setTimeout(() => setRestoreState('idle'), 2500);
  }, [restoreCode, restorePin]);

  return (
    <>
      <button className="profile-badge" onClick={() => { setProfile(loadProfile()); setOpen(true); }}>
        👤 {profile ? `${profile.name} · ⭐${profile.points}` : t('profileTitle')}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="profile-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              className="profile-modal"
              initial={{ y: 30, scale: 0.94, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 30, scale: 0.94, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="profile-header">
                <span className="profile-title">👤 {t('profileTitle')}</span>
                <button className="profile-close" onClick={() => setOpen(false)} aria-label="✕">✕</button>
              </div>

              {profile ? (
                <>
                  <div className="profile-summary">
                    <span className="profile-name">{profile.name}</span>
                    <span className="profile-points">⭐ {profile.points} {t('profilePoints')}</span>
                  </div>
                  <CopyRow label={t('profileId')} value={profile.id} />
                  <CopyRow label={t('profilePin')} value={profile.pin} secret />
                  <CopyRow label={t('profileCode')} value={exportProfileCode(profile)} />
                  <p className="profile-hint">{t('profileCodeHint')}</p>
                </>
              ) : (
                <p className="profile-hint">{t('profileEmpty')}</p>
              )}

              <div className="profile-divider">{t('profileRestore')}</div>
              <input
                className="profile-input"
                placeholder={t('profileCodePlaceholder')}
                value={restoreCode}
                onChange={(e) => setRestoreCode(e.target.value)}
              />
              <div className="profile-restore-row">
                <input
                  className="profile-input profile-input--pin"
                  placeholder="PIN"
                  inputMode="numeric"
                  maxLength={4}
                  value={restorePin}
                  onChange={(e) => setRestorePin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                />
                <button
                  className="btn btn-green profile-restore-btn"
                  disabled={!restoreCode.trim() || restorePin.length !== 4}
                  onClick={handleRestore}
                >
                  🔓 {t('profileRestoreBtn')}
                </button>
              </div>
              {restoreState === 'ok' && <p className="profile-feedback profile-feedback--ok">✅ {t('profileRestoreOk')}</p>}
              {restoreState === 'bad' && <p className="profile-feedback profile-feedback--bad">⚠️ {t('profileRestoreBad')}</p>}
            </motion.div>

            <style>{`
              .profile-backdrop {
                position: fixed;
                inset: 0;
                z-index: 120;
                background: rgba(12, 5, 40, 0.6);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 18px;
              }
              .profile-modal {
                width: 100%;
                max-width: 420px;
                border-radius: 22px;
                background: linear-gradient(165deg, #3d2b8f, #241865);
                border: 2px solid rgba(255, 255, 255, 0.22);
                box-shadow: 0 18px 50px rgba(8, 2, 30, 0.6);
                padding: 16px;
                display: flex;
                flex-direction: column;
                gap: 10px;
                max-height: 86dvh;
                overflow-y: auto;
              }
              .profile-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
              }
              .profile-title {
                font-family: var(--font-display);
                font-size: 1.1rem;
                font-weight: 800;
              }
              .profile-close {
                width: 30px;
                height: 30px;
                border-radius: 50%;
                border: none;
                background: rgba(255, 255, 255, 0.14);
                color: var(--color-text-secondary);
                font-weight: 800;
                cursor: pointer;
              }
              .profile-summary {
                display: flex;
                align-items: center;
                justify-content: space-between;
                background: rgba(255, 255, 255, 0.08);
                border-radius: var(--radius-lg);
                padding: 10px 14px;
              }
              .profile-name {
                font-family: var(--font-display);
                font-weight: 800;
                font-size: 1rem;
              }
              .profile-points {
                font-weight: 800;
                color: #ffd65a;
                font-size: 0.9rem;
              }
              .profile-row {
                display: flex;
                align-items: center;
                gap: 8px;
                min-width: 0;
              }
              .profile-row-label {
                flex-shrink: 0;
                width: 52px;
                font-size: 0.7rem;
                font-weight: 800;
                text-transform: uppercase;
                color: var(--color-text-muted);
              }
              .profile-row-value {
                flex: 1;
                min-width: 0;
                font-family: var(--font-display);
                font-weight: 800;
                font-size: 0.82rem;
                color: #ffd65a;
                background: rgba(0, 0, 0, 0.25);
                border-radius: var(--radius-md);
                padding: 6px 10px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              }
              .profile-row-copy {
                flex-shrink: 0;
                border: none;
                border-radius: var(--radius-full);
                background: rgba(255, 255, 255, 0.14);
                color: var(--color-text);
                font-weight: 800;
                font-size: 0.72rem;
                padding: 6px 10px;
                cursor: pointer;
              }
              .profile-hint {
                font-size: 0.74rem;
                font-weight: 700;
                color: var(--color-text-secondary);
                line-height: 1.4;
              }
              .profile-divider {
                text-align: center;
                font-size: 0.72rem;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 1px;
                color: var(--color-text-muted);
                display: flex;
                align-items: center;
                gap: 10px;
                margin-top: 4px;
              }
              .profile-divider::before,
              .profile-divider::after {
                content: '';
                flex: 1;
                height: 1px;
                background: rgba(255, 255, 255, 0.15);
              }
              .profile-input {
                width: 100%;
                padding: 10px 14px;
                border-radius: var(--radius-lg);
                border: 2px solid rgba(255, 255, 255, 0.22);
                background: rgba(255, 255, 255, 0.1);
                color: var(--color-text);
                font-family: var(--font-body);
                font-size: 0.85rem;
                font-weight: 700;
                outline: none;
              }
              .profile-input:focus { border-color: #ffd65a; }
              .profile-restore-row {
                display: flex;
                gap: 8px;
              }
              .profile-input--pin {
                width: 90px;
                text-align: center;
                letter-spacing: 4px;
                font-family: var(--font-display);
              }
              .profile-restore-btn { flex: 1; }
              .profile-feedback {
                text-align: center;
                font-size: 0.8rem;
                font-weight: 800;
                padding: 6px 12px;
                border-radius: var(--radius-full);
              }
              .profile-feedback--ok {
                color: #b8f5cd;
                background: rgba(38, 193, 101, 0.2);
              }
              .profile-feedback--bad {
                color: #ffb0bb;
                background: rgba(240, 64, 92, 0.2);
              }
            `}</style>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .profile-badge {
          position: absolute;
          top: calc(14px + env(safe-area-inset-top));
          left: 14px;
          padding: 8px 14px;
          border-radius: var(--radius-full);
          border: 2px solid rgba(255, 255, 255, 0.25);
          background: rgba(255, 255, 255, 0.12);
          color: var(--color-text);
          font-family: var(--font-display);
          font-weight: 800;
          font-size: 0.8rem;
          cursor: pointer;
          z-index: 5;
          backdrop-filter: blur(8px);
          max-width: 55vw;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      `}</style>
    </>
  );
}
