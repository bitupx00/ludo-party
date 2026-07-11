import { AnimatePresence, motion } from 'framer-motion';
import Lobby from './components/Lobby.tsx';
import Game from './components/Game.tsx';
import { useGameStore } from './store/gameStore.ts';
import './index.css';

const pageVariants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 1.05 },
};

export default function App() {
  const phase = useGameStore(s => s.phase);

  return (
    <AnimatePresence mode="wait">
      {phase === 'lobby' ? (
        <motion.div
          key="lobby"
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          style={{ minHeight: '100dvh' }}
        >
          <Lobby />
        </motion.div>
      ) : (
        <motion.div
          key="game"
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          style={{ minHeight: '100dvh' }}
        >
          <Game />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
