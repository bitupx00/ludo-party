import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { startProfileSync } from './profile.ts'
import { seedDefaultMemes } from './inventory.ts'
import BoardHex from './components/BoardHex.tsx'

// Persist the local player's shop points to their device profile
startProfileSync()
// Give every device its random 30-meme starter pack (fails soft offline)
void seedDefaultMemes()

// Design preview: /?hexpreview renders the 6-player hexagonal board
// prototype standalone (geometry validation before wiring the engine).
const HEX_PREVIEW = new URLSearchParams(window.location.search).has('hexpreview')

function BoardHexPreview() {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12, padding: 12 }}>
      <h1 style={{ textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: '1.1rem' }}>
        Ludo 6 jugadores — prototipo de tablero
      </h1>
      <BoardHex showIndexes={new URLSearchParams(window.location.search).has('idx')} />
      <p style={{ textAlign: 'center', fontSize: '0.75rem', opacity: 0.75 }}>
        78 casillas · 6 salidas · 12 seguras · pasillos de 6 · añade &idx para ver los índices
      </p>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {HEX_PREVIEW ? <BoardHexPreview /> : <App />}
  </StrictMode>,
)
