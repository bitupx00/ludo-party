/**
 * Dice skins — 80 purchasable models in 10 themed collections, priced
 * 3,000–40,000 puntos by RARITY. Purely cosmetic: each skin is CSS
 * custom properties consumed by Dice3D / MiniDice / the inventory
 * preview, so every design renders razor-sharp at any size (vector, no
 * bitmaps):
 *  - face gradient (--d3-f1/f2/f3) + border (--d3-bd)
 *  - pip gradient (--d3-p1/p2/p3)
 *  - optional PATTERN layer (--d3-pattern: repeating/conic gradients —
 *    carbon fiber, marble, circuit, honeycomb, sunburst, candy stripes…)
 *  - optional animated EFFECT (glow halo, rainbow hue cycle, sparkle,
 *    fire flicker, dark aura)
 * Synced through Player.diceSkin so everyone sees each player's dice.
 */

export type DiceRarity = 'comun' | 'raro' | 'epico' | 'legendario';
export type DiceEffect = 'glow' | 'rainbow' | 'sparkle' | 'fire' | 'aura';

export interface DiceSkin {
  id: string;
  name: string;
  collection: string;
  rarity: DiceRarity;
  /** Price in puntos (0 = free/default). */
  price: number;
  /** CSS custom properties consumed by Dice3D / MiniDice. */
  vars: Record<string, string>;
  effect?: DiceEffect;
}

export const RARITY_INFO: Record<DiceRarity, { name: string; color: string }> = {
  comun: { name: 'Común', color: '#9aa3b5' },
  raro: { name: 'Raro', color: '#4da3ff' },
  epico: { name: 'Épico', color: '#c069ff' },
  legendario: { name: 'Legendario', color: '#ffb02e' },
};

/* ── Pattern library (pure CSS gradients — tile without background-size) ── */
/** Cartoon paw-print tile (inline SVG, transparent background). */
function PAW(color: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'><g fill='${color}'><ellipse cx='24' cy='28' rx='7' ry='6'/><circle cx='15' cy='19' r='3.2'/><circle cx='21.5' cy='15.5' r='3.2'/><circle cx='28.5' cy='15.5' r='3.2'/><circle cx='34' cy='19' r='3.2'/></g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const PAT = {
  stripes: (c: string) => `repeating-linear-gradient(45deg, ${c} 0 7%, transparent 7% 18%)`,
  candy: (c: string) => `repeating-linear-gradient(-45deg, ${c} 0 10%, transparent 10% 22%)`,
  cross: (c: string) => `repeating-linear-gradient(0deg, ${c} 0 3%, transparent 3% 14%), repeating-linear-gradient(90deg, ${c} 0 3%, transparent 3% 14%)`,
  carbon: (c: string) => `repeating-linear-gradient(45deg, ${c} 0 6%, transparent 6% 12%), repeating-linear-gradient(-45deg, ${c} 0 6%, transparent 6% 12%)`,
  rings: (c: string) => `repeating-radial-gradient(circle at 50% 50%, ${c} 0 4%, transparent 4% 13%)`,
  sun: (c: string) => `repeating-conic-gradient(from 0deg at 50% 50%, ${c} 0deg 12deg, transparent 12deg 30deg)`,
  checker: (c: string) => `repeating-conic-gradient(from 0deg at 50% 50%, ${c} 0deg 90deg, transparent 90deg 180deg)`,
  circuit: (c: string) => `repeating-linear-gradient(0deg, ${c} 0 2%, transparent 2% 24%), repeating-linear-gradient(90deg, ${c} 0 2%, transparent 2% 24%)`,
  honey: (c: string) => `repeating-linear-gradient(0deg, ${c} 0 3%, transparent 3% 16%), repeating-linear-gradient(60deg, ${c} 0 3%, transparent 3% 16%), repeating-linear-gradient(120deg, ${c} 0 3%, transparent 3% 16%)`,
  marble: (c: string) => `linear-gradient(115deg, transparent 38%, ${c} 41%, transparent 45%), linear-gradient(65deg, transparent 60%, ${c} 63%, transparent 68%), linear-gradient(150deg, transparent 22%, ${c} 24%, transparent 27%)`,
  galaxy: (c: string) => `radial-gradient(circle at 22% 28%, ${c} 0 6%, transparent 7%), radial-gradient(circle at 74% 18%, ${c} 0 4%, transparent 5%), radial-gradient(circle at 60% 72%, ${c} 0 5%, transparent 6%), radial-gradient(circle at 30% 78%, ${c} 0 3%, transparent 4%), radial-gradient(circle at 84% 55%, ${c} 0 3%, transparent 4%)`,
  lava: (c: string) => `radial-gradient(ellipse at 30% 70%, ${c} 0 18%, transparent 34%), radial-gradient(ellipse at 72% 30%, ${c} 0 14%, transparent 30%), radial-gradient(ellipse at 55% 88%, ${c} 0 10%, transparent 24%)`,
  waves: (c: string) => `repeating-radial-gradient(circle at 50% 120%, ${c} 0 5%, transparent 5% 14%)`,
  petals: (c: string) => `repeating-conic-gradient(from 15deg at 50% 50%, ${c} 0deg 18deg, transparent 18deg 60deg)`,
  diamondgrid: (c: string) => `repeating-linear-gradient(30deg, ${c} 0 2.5%, transparent 2.5% 15%), repeating-linear-gradient(-30deg, ${c} 0 2.5%, transparent 2.5% 15%)`,
};

/* ── Compact builder ────────────────────────────────────────────────── */
function mk(
  id: string,
  name: string,
  collection: string,
  rarity: DiceRarity,
  price: number,
  faces: [string, string, string],
  pips: [string, string, string],
  opts: { bd?: string; glowC?: string; pattern?: string; effect?: DiceEffect } = {},
): DiceSkin {
  const vars: Record<string, string> = {
    '--d3-f1': faces[0], '--d3-f2': faces[1], '--d3-f3': faces[2],
    '--d3-bd': opts.bd ?? 'rgba(20, 12, 60, 0.35)',
    '--d3-p1': pips[0], '--d3-p2': pips[1], '--d3-p3': pips[2],
  };
  if (opts.glowC) vars['--d3-glow'] = opts.glowC;
  if (opts.pattern) vars['--d3-pattern'] = opts.pattern;
  return { id, name, collection, rarity, price, vars, effect: opts.effect };
}

/* ════════════════════════ 80 DICE · 10 COLLECTIONS ═══════════════════ */

export const DICE_SKINS: DiceSkin[] = [
  /* ── 1 · CLÁSICOS (común) ── */
  mk('clasico', 'Clásico', 'Clásicos', 'comun', 0,
    ['#ffffff', '#f3eee2', '#ddd3bd'], ['#6b5cf0', '#4534b8', '#32247e'], { bd: 'rgba(120,100,60,.25)' }),
  mk('marfil', 'Marfil', 'Clásicos', 'comun', 3000,
    ['#fffdf4', '#f6ecd4', '#e2cfa4'], ['#8a6b3a', '#6b4e24', '#4a3315']),
  mk('medianoche', 'Medianoche', 'Clásicos', 'comun', 3000,
    ['#3a4460', '#232c45', '#131b30'], ['#dfe7ff', '#aebbe0', '#7f8fbd']),
  mk('carmesi', 'Carmesí', 'Clásicos', 'comun', 4000,
    ['#ff8fa0', '#f0405c', '#b31f3c'], ['#ffffff', '#ffe1e7', '#ffb9c6']),
  mk('pino', 'Pino', 'Clásicos', 'comun', 4000,
    ['#7dedaa', '#26c165', '#157a43'], ['#ffffff', '#e3ffe9', '#b7f2c7']),
  mk('marino', 'Marino', 'Clásicos', 'comun', 4000,
    ['#8fb8ff', '#3d7bfa', '#2453c4'], ['#ffffff', '#e4edff', '#bcd2ff']),
  mk('canela', 'Canela', 'Clásicos', 'comun', 5000,
    ['#e8b98a', '#c98a4b', '#96612d'], ['#4a2c12', '#33200e', '#221507']),
  mk('grafito', 'Grafito', 'Clásicos', 'comun', 5000,
    ['#6b7280', '#454b57', '#2a2f38'], ['#f3f4f6', '#d3d7de', '#aab0bb']),

  /* ── 2 · DULCES (común/raro) ── */
  mk('chocolate', 'Chocolate', 'Dulces', 'comun', 5000,
    ['#8a5a3b', '#5f3a22', '#3e2413'], ['#ffe8cf', '#f5cf9f', '#e0ab6e'],
    { pattern: PAT.waves('rgba(255,230,200,.14)') }),
  mk('fresa', 'Fresa Crema', 'Dulces', 'raro', 7000,
    ['#ffd7e2', '#ff9fb8', '#f26389'], ['#a01d43', '#7d1231', '#570b20'],
    { pattern: PAT.galaxy('rgba(255,255,255,.35)') }),
  mk('menta', 'Menta Chip', 'Dulces', 'raro', 7000,
    ['#d7fff0', '#93f0cd', '#4ecda0'], ['#0f5c42', '#0a4030', '#062a1f'],
    { pattern: PAT.galaxy('rgba(30,60,45,.3)') }),
  mk('caramelo', 'Caramelo', 'Dulces', 'raro', 8000,
    ['#ffe3a1', '#f8b64c', '#d98a17'], ['#7a4304', '#5c3203', '#3d2102'],
    { pattern: PAT.candy('rgba(255,255,255,.22)') }),
  mk('uva-glas', 'Uva Glaseada', 'Dulces', 'raro', 8000,
    ['#ecd7ff', '#c69bf2', '#9b5fd8'], ['#4b1d78', '#37135b', '#240b3d'],
    { pattern: PAT.rings('rgba(255,255,255,.14)') }),
  mk('limon', 'Limonada', 'Dulces', 'raro', 8000,
    ['#fdffcf', '#f2f27e', '#d8d232'], ['#5c5c07', '#454504', '#2e2e02'],
    { pattern: PAT.sun('rgba(255,255,255,.25)') }),
  mk('algodon', 'Algodón de Azúcar', 'Dulces', 'raro', 9000,
    ['#ffe4f2', '#c9d8ff', '#f8b8dd'], ['#8248b3', '#63348c', '#432158'],
    { pattern: PAT.lava('rgba(255,255,255,.35)') }),
  mk('chicle', 'Chicle Globo', 'Dulces', 'raro', 9000,
    ['#ffc4e2', '#ff8cc4', '#ef56a0'], ['#ffffff', '#ffe6f3', '#ffc0e0'],
    { pattern: PAT.rings('rgba(255,255,255,.2)'), glowC: 'rgba(255,140,196,.5)' }),

  /* ── 3 · NATURALEZA (raro) ── */
  mk('lava', 'Lava Viva', 'Naturaleza', 'raro', 9000,
    ['#3c1210', '#24090b', '#120405'], ['#ffb15c', '#ff7a2f', '#e8480f'],
    { pattern: PAT.lava('rgba(255,110,40,.4)'), glowC: 'rgba(255,110,40,.45)' }),
  mk('abismo', 'Abismo Marino', 'Naturaleza', 'raro', 9000,
    ['#0d3b52', '#072536', '#03141f'], ['#6ee7ff', '#2fc4ea', '#0e93b8'],
    { pattern: PAT.waves('rgba(110,231,255,.16)') }),
  mk('selva', 'Selva', 'Naturaleza', 'raro', 10000,
    ['#1c5433', '#123a22', '#0a2414'], ['#b9f56e', '#8dd63e', '#5da41d'],
    { pattern: PAT.petals('rgba(185,245,110,.14)') }),
  mk('duna', 'Duna', 'Naturaleza', 'raro', 10000,
    ['#f2d9a4', '#dcb377', '#b8854a'], ['#6d4a1f', '#503413', '#33200a'],
    { pattern: PAT.waves('rgba(255,255,255,.18)') }),
  mk('glaciar', 'Glaciar', 'Naturaleza', 'raro', 10000,
    ['#eafaff', '#b9e7fa', '#7cc3e8'], ['#0e5f8a', '#0a4463', '#062b3f'],
    { pattern: PAT.marble('rgba(255,255,255,.5)') }),
  mk('tormenta', 'Tormenta', 'Naturaleza', 'raro', 11000,
    ['#5a6478', '#394152', '#20242f'], ['#ffe66e', '#ffd21f', '#e3ab00'],
    { pattern: PAT.marble('rgba(255,230,110,.35)') }),
  mk('coral-vivo', 'Arrecife', 'Naturaleza', 'raro', 11000,
    ['#ff9d80', '#f4693f', '#c93f18'], ['#03303c', '#022129', '#011318'],
    { pattern: PAT.honey('rgba(255,255,255,.14)') }),
  mk('cerezo', 'Flor de Cerezo', 'Naturaleza', 'raro', 12000,
    ['#fff0f4', '#ffd3e0', '#f7a6c1'], ['#8c2f4d', '#6b2039', '#471223'],
    { pattern: PAT.petals('rgba(247,166,193,.28)') }),

  /* ── 4 · GEMAS (raro/épico) ── */
  mk('zafiro', 'Zafiro', 'Gemas', 'raro', 6000,
    ['#e8eef7', '#9db4cc', '#51677f'], ['#27415e', '#122a44', '#081527']),
  mk('esmeralda', 'Esmeralda', 'Gemas', 'raro', 9000,
    ['#e9fbf1', '#a8ecc6', '#57b981'], ['#1e7a4b', '#12552f', '#0a3118']),
  mk('rubi', 'Rubí', 'Gemas', 'epico', 14000,
    ['#ffe9ec', '#ffb3bd', '#e05263'], ['#a3132e', '#7c0e23', '#520917'],
    { glowC: 'rgba(255,90,115,.55)', pattern: PAT.marble('rgba(255,255,255,.4)') }),
  mk('amatista', 'Amatista', 'Gemas', 'epico', 15000,
    ['#f3e8ff', '#d3b1fb', '#a86ee8'], ['#5c22a8', '#43187c', '#2b0e52'],
    { glowC: 'rgba(168,110,232,.5)', pattern: PAT.marble('rgba(255,255,255,.4)') }),
  mk('ambar', 'Ámbar', 'Gemas', 'epico', 15000,
    ['#fff2d0', '#ffd98a', '#e8a83e'], ['#8a5406', '#653c04', '#402602'],
    { glowC: 'rgba(255,190,90,.5)', pattern: PAT.lava('rgba(255,255,255,.3)') }),
  mk('turmalina', 'Turmalina', 'Gemas', 'epico', 16000,
    ['#d8fff4', '#7fe9ce', '#2fbfa0'], ['#065f4e', '#044437', '#022b22'],
    { glowC: 'rgba(60,220,185,.5)', pattern: PAT.diamondgrid('rgba(255,255,255,.2)') }),
  mk('onix', 'Ónix', 'Gemas', 'epico', 17000,
    ['#3a3a44', '#22222b', '#101016'], ['#e9e9f2', '#c3c3d4', '#9494ad'],
    { glowC: 'rgba(150,150,200,.4)', pattern: PAT.marble('rgba(255,255,255,.22)') }),
  mk('diamante', 'Diamante', 'Gemas', 'epico', 20000,
    ['#ffffff', '#e6f3ff', '#b8d9f2'], ['#3e6d8f', '#2a4d68', '#193143'],
    { glowC: 'rgba(200,235,255,.7)', pattern: PAT.diamondgrid('rgba(255,255,255,.45)') }),

  /* ── 5 · METALES (raro/épico) ── */
  mk('bronce', 'Bronce', 'Metales', 'raro', 8000,
    ['#e8b784', '#c08a52', '#8f5f30'], ['#452c12', '#31200c', '#1f1406'],
    { pattern: PAT.cross('rgba(255,255,255,.1)') }),
  mk('cobre', 'Cobre', 'Metales', 'raro', 9000,
    ['#ffb894', '#e07b4d', '#a85630'], ['#4a2311', '#35180b', '#200e06'],
    { pattern: PAT.stripes('rgba(255,255,255,.12)') }),
  mk('plata', 'Plata', 'Metales', 'raro', 12000,
    ['#f8fafc', '#d7dee7', '#a9b6c4'], ['#4c5866', '#37414c', '#232a32'],
    { pattern: PAT.stripes('rgba(255,255,255,.3)') }),
  mk('acero', 'Acero Damasco', 'Metales', 'epico', 14000,
    ['#aebbc7', '#7f8e9c', '#535f6b'], ['#1d242b', '#12181d', '#090c0f'],
    { pattern: PAT.marble('rgba(255,255,255,.35)') }),
  mk('titanio', 'Titanio', 'Metales', 'epico', 16000,
    ['#c8ccd8', '#8e93a6', '#5b6072'], ['#f2b632', '#d1961a', '#a3730e'],
    { pattern: PAT.carbon('rgba(0,0,0,.12)') }),
  mk('oro-rosa', 'Oro Rosa', 'Metales', 'epico', 18000,
    ['#ffe0d6', '#f2b5a4', '#d98a77'], ['#7c3a2c', '#5c281d', '#3d1811'],
    { glowC: 'rgba(242,181,164,.5)', pattern: PAT.stripes('rgba(255,255,255,.2)') }),
  mk('dorado', 'Dorado', 'Metales', 'epico', 20000,
    ['#fff7d6', '#ffd65a', '#d4a017'], ['#8a5a06', '#6b4404', '#452b02'],
    { glowC: 'rgba(255,200,60,.6)' }),
  mk('platino', 'Platino', 'Metales', 'epico', 24000,
    ['#f4f7fa', '#dee6ee', '#bccbda'], ['#2d3d4e', '#1e2a37', '#111a23'],
    { glowC: 'rgba(220,235,250,.6)', pattern: PAT.diamondgrid('rgba(255,255,255,.3)') }),

  /* ── 6 · PATRONES DELUXE (épico) ── */
  mk('carbono', 'Fibra de Carbono', 'Patrones Deluxe', 'epico', 15000,
    ['#33363c', '#1e2126', '#0e1013'], ['#ff4757', '#e42133', '#b1101f'],
    { pattern: PAT.carbon('rgba(255,255,255,.09)') }),
  mk('circuito', 'Circuito', 'Patrones Deluxe', 'epico', 16000,
    ['#062b1e', '#041912', '#02100b'], ['#3cff9d', '#0fe07a', '#08a457'],
    { pattern: PAT.circuit('rgba(60,255,157,.25)'), glowC: 'rgba(60,255,157,.4)' }),
  mk('ajedrez', 'Ajedrez', 'Patrones Deluxe', 'epico', 16000,
    ['#f6f1e6', '#ddd2ba', '#b8a98a'], ['#17171d', '#101014', '#08080b'],
    { pattern: PAT.checker('rgba(20,20,28,.85)') }),
  mk('panal', 'Panal Real', 'Patrones Deluxe', 'epico', 17000,
    ['#ffd985', '#f2b93e', '#cf8f13'], ['#4c3305', '#372403', '#221602'],
    { pattern: PAT.honey('rgba(120,80,10,.28)') }),
  mk('damasco', 'Damasco', 'Patrones Deluxe', 'epico', 18000,
    ['#3c2a68', '#291b4c', '#170e30'], ['#ffd65a', '#ecb62e', '#c08f12'],
    { pattern: PAT.petals('rgba(255,214,90,.22)') }),
  mk('rayas-real', 'Rayas Reales', 'Patrones Deluxe', 'epico', 18000,
    ['#20315c', '#152142', '#0b1226'], ['#ffffff', '#dfe7fa', '#b7c6ea'],
    { pattern: PAT.candy('rgba(255,255,255,.16)') }),
  mk('sol-azteca', 'Sol Azteca', 'Patrones Deluxe', 'epico', 20000,
    ['#f2a33c', '#d97f16', '#a85b0a'], ['#3d1e04', '#2b1503', '#190b01'],
    { pattern: PAT.sun('rgba(61,30,4,.3)'), glowC: 'rgba(242,163,60,.45)' }),
  mk('laberinto', 'Laberinto', 'Patrones Deluxe', 'epico', 22000,
    ['#e8e4f8', '#c4bce6', '#948ac2'], ['#2f2358', '#211840', '#140e29'],
    { pattern: PAT.cross('rgba(47,35,88,.3)') }),

  /* ── 7 · NEÓN (épico) ── */
  mk('neon', 'Neón Esmeralda', 'Neón', 'epico', 18000,
    ['#2b3648', '#171e2b', '#080b12'], ['#7dffb8', '#2bff8b', '#0dbb5d'],
    { bd: 'rgba(60,255,150,.5)', glowC: 'rgba(45,255,140,.55)' }),
  mk('neon-rosa', 'Neón Rosa', 'Neón', 'epico', 18000,
    ['#3a2334', '#22131f', '#0f070d'], ['#ff8ad8', '#ff47c1', '#d11493'],
    { bd: 'rgba(255,80,200,.5)', glowC: 'rgba(255,80,200,.55)' }),
  mk('neon-azul', 'Neón Cobalto', 'Neón', 'epico', 18000,
    ['#1e2a44', '#111a2e', '#070c17'], ['#6ec1ff', '#2f9bff', '#0d6fd6'],
    { bd: 'rgba(60,160,255,.5)', glowC: 'rgba(60,160,255,.55)' }),
  mk('neon-lila', 'Neón Lila', 'Neón', 'epico', 19000,
    ['#2c2044', '#1a1230', '#0b0617'], ['#c99bff', '#a55eff', '#7a2ee8'],
    { bd: 'rgba(165,94,255,.5)', glowC: 'rgba(165,94,255,.55)' }),
  mk('neon-naranja', 'Neón Naranja', 'Neón', 'epico', 19000,
    ['#3c2617', '#26160b', '#120904'], ['#ffb06e', '#ff8226', '#e05e07'],
    { bd: 'rgba(255,130,38,.5)', glowC: 'rgba(255,130,38,.55)' }),
  mk('neon-cian', 'Neón Cian', 'Neón', 'epico', 19000,
    ['#15343c', '#0b2127', '#041114'], ['#71fff2', '#22f2df', '#0abfae'],
    { bd: 'rgba(34,242,223,.5)', glowC: 'rgba(34,242,223,.55)' }),
  mk('neon-amarillo', 'Neón Ámbar', 'Neón', 'epico', 20000,
    ['#38321a', '#231f0e', '#100e05'], ['#fff06e', '#ffe226', '#e0bd07'],
    { bd: 'rgba(255,226,38,.5)', glowC: 'rgba(255,226,38,.5)' }),
  mk('neon-rojo', 'Neón Escarlata', 'Neón', 'epico', 20000,
    ['#3c1a1e', '#260d10', '#120406'], ['#ff7d8a', '#ff3d52', '#d61227'],
    { bd: 'rgba(255,61,82,.5)', glowC: 'rgba(255,61,82,.55)' }),

  /* ── 8 · CÓSMICOS (legendario) ── */
  mk('luna-llena', 'Luna Llena', 'Cósmicos', 'legendario', 28000,
    ['#f2f4f8', '#cdd3de', '#9aa3b5'], ['#3c4356', '#2a3040', '#191d29'],
    { pattern: PAT.lava('rgba(120,130,155,.3)'), glowC: 'rgba(220,228,245,.6)', effect: 'glow' }),
  mk('marte', 'Marte', 'Cósmicos', 'legendario', 29000,
    ['#e07b52', '#b34f2b', '#7c3118'], ['#ffd9c4', '#ffb894', '#f2926a'],
    { pattern: PAT.lava('rgba(255,180,140,.25)'), glowC: 'rgba(224,123,82,.5)', effect: 'fire' }),
  mk('cometa', 'Cometa', 'Cósmicos', 'legendario', 30000,
    ['#12365c', '#0a2340', '#041124'], ['#bfe8ff', '#7fd0ff', '#38aef2'],
    { pattern: PAT.stripes('rgba(190,230,255,.2)'), glowC: 'rgba(130,205,255,.6)', effect: 'sparkle' }),
  mk('aurora-boreal', 'Aurora Boreal', 'Cósmicos', 'legendario', 32000,
    ['#0c3040', '#123c2e', '#071a24'], ['#8affd8', '#4ce8b8', '#78c4ff'],
    { pattern: PAT.marble('rgba(120,255,215,.35)'), glowC: 'rgba(100,240,200,.55)', effect: 'rainbow' }),
  mk('eclipse', 'Eclipse', 'Cósmicos', 'legendario', 34000,
    ['#1a1424', '#0e0a16', '#05030a'], ['#ffcb6e', '#ffab1f', '#e08600'],
    { pattern: PAT.rings('rgba(255,190,90,.18)'), glowC: 'rgba(255,180,80,.55)', effect: 'aura' }),
  mk('nebulosa', 'Nebulosa', 'Cósmicos', 'legendario', 36000,
    ['#40216e', '#28124c', '#12061f'], ['#ff9ae0', '#c96eff', '#6e9aff'],
    { pattern: PAT.galaxy('rgba(255,170,235,.4)'), glowC: 'rgba(200,120,255,.55)', effect: 'sparkle' }),
  mk('supernova', 'Supernova', 'Cósmicos', 'legendario', 38000,
    ['#3c1d0e', '#241005', '#100601'], ['#fff09e', '#ffc94d', '#ff8c1f'],
    { pattern: PAT.sun('rgba(255,200,90,.3)'), glowC: 'rgba(255,190,70,.65)', effect: 'fire' }),
  mk('galaxia', 'Galaxia', 'Cósmicos', 'legendario', 40000,
    ['#3b2d6e', '#241a4d', '#120c2b'], ['#c9b4ff', '#9a72ff', '#6a3df0'],
    { bd: 'rgba(160,120,255,.55)', pattern: PAT.galaxy('rgba(200,180,255,.45)'), glowC: 'rgba(150,100,255,.65)', effect: 'sparkle' }),

  /* ── 9 · ELEMENTALES (legendario) ── */
  mk('fuego-vivo', 'Fuego Vivo', 'Elementales', 'legendario', 30000,
    ['#4c1206', '#2e0a03', '#160401'], ['#ffd166', '#ff8c2f', '#f2500a'],
    { pattern: PAT.lava('rgba(255,120,40,.45)'), glowC: 'rgba(255,110,30,.6)', effect: 'fire' }),
  mk('hielo-eterno', 'Hielo Eterno', 'Elementales', 'legendario', 30000,
    ['#eefbff', '#c2ecfa', '#8ed2ef'], ['#0a5f8c', '#074565', '#042b40'],
    { pattern: PAT.diamondgrid('rgba(255,255,255,.4)'), glowC: 'rgba(160,225,255,.6)', effect: 'glow' }),
  mk('rayo', 'Rayo', 'Elementales', 'legendario', 32000,
    ['#2b2b3c', '#1a1a26', '#0c0c13'], ['#fff26e', '#ffe226', '#f2b90a'],
    { pattern: PAT.stripes('rgba(255,235,110,.25)'), glowC: 'rgba(255,230,70,.6)', effect: 'sparkle' }),
  mk('veneno', 'Veneno', 'Elementales', 'legendario', 32000,
    ['#1e3c14', '#122609', '#081203'], ['#b4ff5c', '#84f21f', '#57c407'],
    { pattern: PAT.lava('rgba(150,255,80,.3)'), glowC: 'rgba(140,245,45,.55)', effect: 'aura' }),
  mk('sombra', 'Sombra', 'Elementales', 'legendario', 34000,
    ['#26202e', '#161119', '#09060b'], ['#b599e8', '#8a63cc', '#5f3aa3'],
    { pattern: PAT.marble('rgba(120,90,180,.35)'), glowC: 'rgba(120,80,190,.55)', effect: 'aura' }),
  mk('luz-divina', 'Luz Divina', 'Elementales', 'legendario', 36000,
    ['#fffdf0', '#fff3c4', '#f8de8d'], ['#c49a1a', '#9a7810', '#6b5209'],
    { pattern: PAT.sun('rgba(255,235,170,.5)'), glowC: 'rgba(255,240,180,.7)', effect: 'glow' }),
  mk('huracan', 'Huracán', 'Elementales', 'legendario', 36000,
    ['#b8c4cc', '#8795a1', '#59666f'], ['#0e2f3c', '#082129', '#041216'],
    { pattern: PAT.rings('rgba(255,255,255,.22)'), glowC: 'rgba(170,200,215,.5)', effect: 'rainbow' }),
  mk('terremoto', 'Terremoto', 'Elementales', 'legendario', 38000,
    ['#6e4a2b', '#4a2f1a', '#2b1a0d'], ['#ffcf8c', '#f2a852', '#cc7d24'],
    { pattern: PAT.marble('rgba(40,25,12,.5)'), glowC: 'rgba(255,180,110,.45)', effect: 'fire' }),

  /* ── ANIMALITOS (cartoon, huellitas en la cara) ── */
  mk('perrito', 'Perrito', 'Animalitos', 'raro', 8000,
    ['#f5d9b0', '#e0b478', '#b3823f'], ['#6b4423', '#4d2f16', '#311d0c'],
    { pattern: PAW('rgba(107,68,35,.28)') }),
  mk('gatito', 'Gatito', 'Animalitos', 'raro', 8000,
    ['#e8e3f5', '#c5bbe0', '#948ab8'], ['#3d3358', '#2b2340', '#191426'],
    { pattern: PAW('rgba(61,51,88,.25)') }),
  mk('panda', 'Panda', 'Animalitos', 'raro', 9000,
    ['#ffffff', '#eef1f4', '#ccd4dc'], ['#20242b', '#14171c', '#0a0c0f'],
    { pattern: PAW('rgba(32,36,43,.3)') }),
  mk('zorrito', 'Zorrito', 'Animalitos', 'raro', 9000,
    ['#ffc190', '#f2933f', '#c4671a'], ['#ffffff', '#ffeede', '#ffd9b8'],
    { pattern: PAW('rgba(255,255,255,.35)') }),
  mk('ranita', 'Ranita', 'Animalitos', 'raro', 10000,
    ['#c8f2a0', '#8fd955', '#5aa829'], ['#20520e', '#173a09', '#0d2205'],
    { pattern: PAW('rgba(32,82,14,.28)') }),
  mk('conejito', 'Conejito', 'Animalitos', 'epico', 14000,
    ['#fff3f6', '#ffd3e0', '#f0a8c0'], ['#8c3355', '#6b243f', '#471628'],
    { pattern: PAW('rgba(140,51,85,.25)'), glowC: 'rgba(240,168,192,.5)' }),
  mk('pinguino', 'Pingüino', 'Animalitos', 'epico', 16000,
    ['#2c3a4c', '#1b2634', '#0d141d'], ['#ffd166', '#f2b23c', '#cc8c14'],
    { pattern: PAW('rgba(255,209,102,.22)'), glowC: 'rgba(120,160,200,.4)' }),
  mk('leoncito', 'Leoncito', 'Animalitos', 'legendario', 30000,
    ['#ffd98c', '#f0b04a', '#c98420'], ['#6b3a08', '#4d2905', '#301903'],
    { pattern: PAW('rgba(107,58,8,.3)'), glowC: 'rgba(255,190,90,.55)', effect: 'sparkle' }),

  /* ── 10 · REALEZA (épico/legendario) ── */
  mk('rosa', 'Rosa', 'Realeza', 'raro', 3000,
    ['#fff0f6', '#ffd6e7', '#f7a8c8'], ['#f06595', '#d6336c', '#a61e4d'],
    { bd: 'rgba(214,51,108,.35)', glowC: 'rgba(246,121,172,.55)' }),
  mk('rey-sol', 'Rey Sol', 'Realeza', 'epico', 22000,
    ['#ffdf8c', '#f2b93e', '#cf8b13'], ['#5c3a05', '#422903', '#291902'],
    { pattern: PAT.sun('rgba(120,80,10,.25)'), glowC: 'rgba(255,205,90,.55)' }),
  mk('reina-noche', 'Reina de la Noche', 'Realeza', 'epico', 24000,
    ['#2a1e4c', '#1a1133', '#0c071a'], ['#ff9ecf', '#f26bb2', '#cc3d8c'],
    { pattern: PAT.galaxy('rgba(255,158,207,.3)'), glowC: 'rgba(242,107,178,.5)' }),
  mk('imperial', 'Imperial', 'Realeza', 'epico', 26000,
    ['#5c1424', '#3d0c17', '#22060c'], ['#ffd65a', '#ecb62e', '#c08f12'],
    { pattern: PAT.petals('rgba(255,214,90,.18)'), glowC: 'rgba(255,200,80,.5)' }),
  mk('zar', 'Zar de Invierno', 'Realeza', 'legendario', 30000,
    ['#e8f0fa', '#c4d6ec', '#93b2d6'], ['#1e3c6e', '#142a4f', '#0b1930'],
    { pattern: PAT.diamondgrid('rgba(255,255,255,.35)'), glowC: 'rgba(190,215,245,.55)', effect: 'glow' }),
  mk('faraon', 'Faraón', 'Realeza', 'legendario', 34000,
    ['#123c48', '#0b2830', '#05161b'], ['#ffce52', '#f2ae1c', '#c8880c'],
    { pattern: PAT.stripes('rgba(255,206,82,.22)'), glowC: 'rgba(255,200,80,.55)', effect: 'glow' }),
  mk('corona', 'Corona de Gala', 'Realeza', 'legendario', 38000,
    ['#fdf7ec', '#f2e2c4', '#dcc394'], ['#8c1f3c', '#6b142c', '#470b1c'],
    { pattern: PAT.petals('rgba(140,31,60,.16)'), glowC: 'rgba(240,220,180,.6)', effect: 'sparkle' }),
  mk('trono', 'Trono Arcoíris', 'Realeza', 'legendario', 40000,
    ['#ffffff', '#f2eefc', '#ded4f2'], ['#8a3df0', '#5f2bd6', '#3d1aa3'],
    { pattern: PAT.diamondgrid('rgba(138,61,240,.18)'), glowC: 'rgba(160,110,255,.6)', effect: 'rainbow' }),
];

const DEFAULT = DICE_SKINS[0];

/** Collections in display order. */
export const DICE_COLLECTIONS: string[] = [...new Set(DICE_SKINS.map((s) => s.collection))];

export function skinById(id?: string | null): DiceSkin {
  return DICE_SKINS.find((s) => s.id === id) ?? DEFAULT;
}

export function isValidSkin(id: string): boolean {
  return DICE_SKINS.some((s) => s.id === id);
}

/* ── Device preference (auto-applied to your seat) ─────────────────── */

const SKIN_KEY = 'ludo-party-dice-skin';

export function loadSkinPref(): string {
  try { return localStorage.getItem(SKIN_KEY) ?? DEFAULT.id; } catch { return DEFAULT.id; }
}

export function saveSkinPref(id: string) {
  try { localStorage.setItem(SKIN_KEY, id); } catch { /* noop */ }
}
