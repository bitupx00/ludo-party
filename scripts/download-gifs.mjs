#!/usr/bin/env node
/**
 * Descarga los GIFs meme por ocasión y genera src/game/memeGifs.json.
 *
 * USO (igual que scripts/download-sounds.mjs):
 *   1. Pega debajo, en GIF_URLS, los enlaces DIRECTOS a .gif (Tenor:
 *      botón compartir → copiar enlace del GIF; Giphy: "GIF link" que
 *      termina en .gif). Puedes poner varios por ocasión.
 *   2. node scripts/download-gifs.mjs
 *   3. Commit de public/gifs/memes/ y src/game/memeGifs.json
 *
 * Mientras una ocasión no tenga GIFs reales, el juego usa sus stickers
 * animados internos como respaldo (ver src/game/memeFx.ts).
 *
 * Ocasiones disponibles:
 *   death        → la pieza que muere
 *   kill         → la pieza que mata
 *   goal         → llegar a la meta
 *   passMover    → pasar junto a un enemigo sin matarlo (el que pasa)
 *   passSurvivor → el enemigo que sobrevive al pase
 *   block        → caer donde hay enemigos imposibles de matar (bloque/estrella)
 *   ownStack     → apilarse con una ficha propia
 *   enemyEntry   → caer en la salida de un enemigo
 *   escape       → escapada con 6 pasando enemigos
 *   gameStart    → arranque de la partida
 *   homeLane     → entrar al pasillo final
 *   teamWin      → victoria
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const GIF_URLS = {
  death: [
    // 'https://media.tenor.com/xxxxxxxx/nombre.gif',
  ],
  kill: [],
  goal: [],
  passMover: [],
  passSurvivor: [],
  block: [],
  ownStack: [],
  enemyEntry: [],
  escape: [],
  gameStart: [],
  homeLane: [],
  teamWin: [],
};

const OUT_DIR = path.resolve('public/gifs/memes');
const MANIFEST = path.resolve('src/game/memeGifs.json');
const MAX_BYTES = 3 * 1024 * 1024; // aviso si un gif pasa de 3MB

await mkdir(OUT_DIR, { recursive: true });

const manifest = {};
let ok = 0;
let fail = 0;

for (const [occasion, urls] of Object.entries(GIF_URLS)) {
  const files = [];
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const file = `${occasion}-${i + 1}.gif`;
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const magic = buf.subarray(0, 4).toString('latin1');
      if (!magic.startsWith('GIF8')) throw new Error('no es un GIF (usa el enlace directo .gif)');
      if (buf.length > MAX_BYTES) {
        console.warn(`⚠️  ${file}: ${(buf.length / 1048576).toFixed(1)}MB — considera uno más liviano`);
      }
      await writeFile(path.join(OUT_DIR, file), buf);
      files.push(`/gifs/memes/${file}`);
      ok++;
      console.log(`✅ ${occasion} ← ${file} (${(buf.length / 1024).toFixed(0)}KB)`);
    } catch (err) {
      fail++;
      console.error(`❌ ${occasion} ${url}: ${err.message}`);
    }
  }
  if (files.length > 0) manifest[occasion] = files;
}

await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
console.log(`\n${ok} GIFs descargados, ${fail} fallidos.`);
console.log(`Manifest actualizado: ${MANIFEST}`);
if (ok === 0) console.log('Pega tus URLs en GIF_URLS dentro de este script y vuelve a ejecutarlo.');
