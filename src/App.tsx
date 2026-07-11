import { AnimatePresence, motion } from 'framer-motion';
import Home from './components/Home.tsx';
import Lobby from './components/Lobby.tsx';
import Game from './components/Game.tsx';
import { useGameStore } from './store/gameStore.ts';
import './index.css';

const pageVariants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 1.04 },
};

const SCREENS = {
  home: Home,
  lobby: Lobby,
  game: Game,
} as const;

export default function App() {
  const screen = useGameStore((s) => s.screen);
  const ScreenComponent = SCREENS[screen];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={screen}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.28, ease: 'easeInOut' }}
        style={{ minHeight: '100dvh' }}
      >
        <ScreenComponent />
      </motion.div>
    </AnimatePresence>
  );
}
