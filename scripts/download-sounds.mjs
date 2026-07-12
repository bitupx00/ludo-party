#!/usr/bin/env node
/**
 * Downloads the meme sound pack (myinstants.com clips) into public/sfx/.
 * Run ONCE on your own machine (the cloud build environment blocks
 * myinstants.com):
 *
 *   node scripts/download-sounds.mjs
 *
 * Every file is optional at runtime — missing clips just stay silent.
 */
import { mkdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'sfx');

/** id (public/sfx/<id>.mp3) → myinstants slug */
const SOUNDS = {
  bomberman: 'bomberman-death-sound-68389',
  oof5: 'fore-oof-x5-with-little-crashes-96567',
  bruh: 'bruh-meme-sound-effect-81569',
  legoyoda: 'lego-yoda-death-slowed-92043',
  grito: 'death-gore-scream-67149',
  faaah: 'faaah-63455',
  pew: 'pew',
  lepego: 'le-pegoooo-69363',
  vinuela: 'risa-de-vinuela',
  rickastley: 'directed-by-rick-astley-52998',
  mariojump: 'mario-jump-death-50704',
  heehee: 'michael-jackson-hee-hee-40277',
  nocreo: 'no-creo-63543',
  yelpico: 'y-el-pico-94857',
  fueradepre: 'fuera-depresion-50280',
  basina: 'suprema-basina-9027',
  hayalguien: 'hay-alguien-ahi-con-vida-larga-45443',
  gatitoboo: 'gatito-boo-monster-inc-4891',
  ysemarcho: 'y-se-marcho-20890',
  helicoptero: 'helicoptero-homero-se-aleja-79228',
  scouts: 'scouts-laugh',
  buenosdias: 'buenos-dias-estrellitas-77206',
  recluta: 'que-es-esto-recluta-16450',
  terrorfx: 'terror-fx-23095',
  patroclo: 'patroclo-7050',
  meamaba: 'cuando-alguien-me-amaba-44363',
  shrekburro: 'shrek-burro-35979',
  diablos: 'diablos-senorita-62539',
  mision: 'mision-cumplida-soldado-12334',
  mcqueen: 'rayo-mcqueen-18996',
  winxp: 'windows-xp-startup-sound-58970',
  batman: 'conozca-sus-limites-batman-37704',
  ayuwoki: 'ayuwoki-84210',
  perraloca: 'esa-perra-esta-loca-78334',
  queasco: 'imbecil-que-asco-que-das-16872',
  miau: 'miau-triste-18533',
  cincomin: 'le-quedan-5-minutos-con-la-chica-66686',
  guayaco: 'chupalo-guayaco-48189',
  tuproblema: 'no-es-mi-problema-es-tu-problema-46387',
  atrapada: 'atrapada-ayuda-10223',
  buenasbuenas: 'buenas-buenas-tiktok-87058',
  quienesese: 'quien-es-ese-53853',
  correperra: 'corre-perra-meme-34332',
  tlabaja: 'tlabajaa-19560',
  ohnonono: 'oh-no-no-no-tik-tok-song-sound-effect-63466',
  tiapaola: 'tia-paola-negro-54079',
  excelente: 'super-excelente-10712',
  ajena: 'ajena-eres-ajena-tiktok-37040',
};

const UA = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' };

mkdirSync(OUT, { recursive: true });
let ok = 0;
const failed = [];

for (const [id, slug] of Object.entries(SOUNDS)) {
  const dest = join(OUT, `${id}.mp3`);
  if (existsSync(dest) && statSync(dest).size > 1000) { ok++; continue; }
  try {
    const page = await fetch(`https://www.myinstants.com/es/instant/${slug}/`, { headers: UA });
    const html = await page.text();
    const m = html.match(/data-url="(\/media\/sounds\/[^"]+)"/) ??
      html.match(/property="og:audio" content="([^"]+)"/);
    if (!m) throw new Error('mp3 url not found in page');
    const mp3Url = m[1].startsWith('/') ? `https://www.myinstants.com${m[1]}` : m[1];
    const mp3 = await fetch(mp3Url, { headers: UA });
    if (!mp3.ok) throw new Error(`HTTP ${mp3.status}`);
    writeFileSync(dest, Buffer.from(await mp3.arrayBuffer()));
    console.log(`✅ ${id}.mp3`);
    ok++;
    await new Promise((r) => setTimeout(r, 200));
  } catch (err) {
    failed.push(id);
    console.log(`❌ ${id}: ${err.message}`);
  }
}

console.log(`\n${ok}/${Object.keys(SOUNDS).length} listos en public/sfx/`);
if (failed.length) console.log('Reintenta los fallidos volviendo a ejecutar el script.');
