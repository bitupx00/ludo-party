# 🎲 Ludo Party

El parchís (ludo) más divertido del universo — estilo **Ludo Club**: diseño pulido, vertical-first, con stickers, reacciones, memes y bots con actitud.

**Demo:** https://ludo-party.vercel.app

## ✨ Características

- 🏠 **Dashboard limpio** con 3 modos de juego:
  - 🤖 **Jugar vs Bots** — tú contra 3 bots
  - 👥 **Pasar y Jugar** — 2–4 amigos en el mismo dispositivo
  - 🤝 **Equipos 2v2** — Rojo+Amarillo vs Verde+Azul (los compañeros no se capturan)
- ♟️ **Piezas 3D glossy** (SVG) estilo juego de mesa premium
- 🎲 **Dado 3D CSS** grande, centro-abajo, tap para tirar
- 😂 **Reacciones rápidas** junto a cada avatar (burbujas tipo WhatsApp) + panel de stickers
- 💥 Overlays de captura con efectos (explosiones, calaveras, estrellas)
- 💬 Chat del juego con mensajes graciosos y trash talk de los bots
- 📹 Video/audio chat opcional entre jugadores (PeerJS)
- 🌎 **Bilingüe** — Español (por defecto) e Inglés
- 📱 **Vertical / mobile-first**, responsive para móvil, tablet y desktop
- 📦 PWA manifest listo para empaquetar como APK (TWA) / iOS más adelante

## 🎮 Reglas

Parchís clásico: saca ficha con 5 o 6, el 6 repite turno (3 seises = pierdes el turno), casillas ⭐ son seguras, captura fichas rivales para mandarlas a su base, mete tus 4 fichas en el centro para ganar. Ver [LUDO_RULES.md](./LUDO_RULES.md).

## 🛠️ Stack

React 19 + TypeScript + Vite · Zustand · Framer Motion · canvas-confetti · PeerJS

## 🚀 Desarrollo

```bash
npm install
npm run dev      # servidor de desarrollo
npm run build    # build de producción (tsc + vite)
npm run lint     # oxlint
```

## 📁 Estructura

```
src/
  game/        # motor puro: engine, path del tablero, IA de bots, tipos
  store/       # estado global (zustand): navegación, turnos, reacciones
  components/  # Home, Lobby, Game, Board, Dice3D, PawnSVG, AvatarBadge...
  i18n.ts      # traducciones ES/EN
```
