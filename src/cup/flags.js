// Cartoon flags for the 48 nations, drawn with Canvas 2D (no image files): simplified
// but recognisable, with rounded corners, an ink outline and a shine like the rest of
// the game. flagTexture(scene, id) builds the texture the first time and returns its key.
import { PALETTE as C } from '../config.js';

const S = 2; // drawn at 2x, like the sprites
export const FLAG_W = 150;
export const FLAG_H = 100;

export function flagTexture(scene, id) {
  const key = `flag-${id}`;
  if (!scene.textures.exists(key)) {
    const w = FLAG_W * S;
    const h = FLAG_H * S;
    const t = scene.textures.createCanvas(key, w, h);
    drawFlag(t.context, id, w, h);
    t.refresh();
  }
  return key;
}

function drawFlag(ctx, id, w, h) {
  const r = 12 * S;
  const pad = 3 * S;
  ctx.save();
  roundRect(ctx, pad, pad, w - pad * 2, h - pad * 2, r);
  ctx.clip();
  ctx.translate(pad, pad);
  (FLAGS[id] ?? FLAGS.fallback)(ctx, w - pad * 2, h - pad * 2);
  // Shine across the top-left.
  const shine = ctx.createLinearGradient(0, 0, w * 0.6, h);
  shine.addColorStop(0, 'rgba(255, 255, 255, 0.28)');
  shine.addColorStop(0.45, 'rgba(255, 255, 255, 0)');
  shine.addColorStop(1, 'rgba(29, 18, 64, 0.18)');
  ctx.fillStyle = shine;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  roundRect(ctx, pad, pad, w - pad * 2, h - pad * 2, r);
  ctx.lineWidth = 3.5 * S;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
}

// ---------- drawing helpers ----------

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

// Horizontal / vertical stripes; weights default to equal.
function hBands(ctx, w, h, colors, weights = colors.map(() => 1)) {
  const total = weights.reduce((a, b) => a + b, 0);
  let y = 0;
  colors.forEach((c, i) => {
    const bh = (h * weights[i]) / total;
    rect(ctx, 0, y, w, bh + 1, c);
    y += bh;
  });
}

function vBands(ctx, w, h, colors, weights = colors.map(() => 1)) {
  const total = weights.reduce((a, b) => a + b, 0);
  let x = 0;
  colors.forEach((c, i) => {
    const bw = (w * weights[i]) / total;
    rect(ctx, x, 0, bw + 1, h, c);
    x += bw;
  });
}

function circle(ctx, x, y, r, color) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function star(ctx, x, y, r, color, points = 5, inner = 0.42, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rr = i % 2 ? r * inner : r;
    const a = rot + (i * Math.PI) / points;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

// Crescent opening to the right: a circle minus a shifted circle of the background.
function crescent(ctx, x, y, r, color, bg, shift = 0.28) {
  circle(ctx, x, y, r, color);
  circle(ctx, x + r * shift, y, r * 0.82, bg);
}

// Nordic cross, shifted toward the hoist.
function nordic(ctx, w, h, color, thick = 0.2) {
  const t = h * thick;
  rect(ctx, w * 0.33 - t / 2, 0, t, h, color);
  rect(ctx, 0, h / 2 - t / 2, w, t, color);
}

function centredCross(ctx, w, h, color, thick = 0.18) {
  const t = h * thick;
  rect(ctx, w / 2 - t / 2, 0, t, h, color);
  rect(ctx, 0, h / 2 - t / 2, w, t, color);
}

function diagonal(ctx, x1, y1, x2, y2, width, color) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke();
}

// Simplified Union Jack in the rectangle (x, y, w, h).
function unionJack(ctx, x, y, w, h) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  rect(ctx, x, y, w, h, '#012169');
  diagonal(ctx, x, y, x + w, y + h, h * 0.2, '#ffffff');
  diagonal(ctx, x + w, y, x, y + h, h * 0.2, '#ffffff');
  diagonal(ctx, x, y, x + w, y + h, h * 0.07, '#c8102e');
  diagonal(ctx, x + w, y, x, y + h, h * 0.07, '#c8102e');
  rect(ctx, x + w / 2 - h * 0.15, y, h * 0.3, h, '#ffffff');
  rect(ctx, x, y + h / 2 - h * 0.15, w, h * 0.3, '#ffffff');
  rect(ctx, x + w / 2 - h * 0.09, y, h * 0.18, h, '#c8102e');
  rect(ctx, x, y + h / 2 - h * 0.09, w, h * 0.18, '#c8102e');
  ctx.restore();
}

// Small round emblem in the middle (stands in for coats of arms).
function emblem(ctx, x, y, r, fill, ring = C.ink) {
  circle(ctx, x, y, r, ring);
  circle(ctx, x, y, r * 0.78, fill);
}

// ---------- the flags ----------

const CELESTE = '#74acdf';

const FLAGS = {
  fallback: (c, w, h) => rect(c, 0, 0, w, h, '#cccccc'),

  // South America
  argentina: (c, w, h) => {
    hBands(c, w, h, [CELESTE, '#ffffff', CELESTE]);
    star(c, w / 2, h / 2, h * 0.13, '#f6b40e', 16, 0.62);
    circle(c, w / 2, h / 2, h * 0.075, '#f6b40e');
  },
  brasil: (c, w, h) => {
    rect(c, 0, 0, w, h, '#009c3b');
    c.beginPath();
    c.moveTo(w / 2, h * 0.1);
    c.lineTo(w * 0.92, h / 2);
    c.lineTo(w / 2, h * 0.9);
    c.lineTo(w * 0.08, h / 2);
    c.closePath();
    c.fillStyle = '#ffdf00';
    c.fill();
    circle(c, w / 2, h / 2, h * 0.24, '#002776');
    c.beginPath();
    c.arc(w / 2 + h * 0.05, h * 0.78, h * 0.4, Math.PI * 1.25, Math.PI * 1.72);
    c.lineWidth = h * 0.045;
    c.strokeStyle = '#ffffff';
    c.stroke();
  },
  uruguay: (c, w, h) => {
    hBands(c, w, h, ['#ffffff', '#0038a8', '#ffffff', '#0038a8', '#ffffff', '#0038a8', '#ffffff', '#0038a8', '#ffffff']);
    rect(c, 0, 0, w * 0.4, h * 5 / 9, '#ffffff');
    star(c, w * 0.2, h * 0.27, h * 0.16, '#fcd116', 16, 0.6);
    circle(c, w * 0.2, h * 0.27, h * 0.09, '#fcd116');
  },
  colombia: (c, w, h) => hBands(c, w, h, ['#fcd116', '#003893', '#ce1126'], [2, 1, 1]),
  ecuador: (c, w, h) => {
    hBands(c, w, h, ['#ffdd00', '#034ea2', '#ed1c24'], [2, 1, 1]);
    emblem(c, w / 2, h * 0.5, h * 0.13, '#5aa0e0');
  },
  paraguay: (c, w, h) => {
    hBands(c, w, h, ['#d52b1e', '#ffffff', '#0038a8']);
    emblem(c, w / 2, h / 2, h * 0.11, '#ffffff', '#0038a8');
    star(c, w / 2, h / 2, h * 0.06, '#fcd116');
  },
  chile: (c, w, h) => {
    rect(c, 0, 0, w, h / 2, '#ffffff');
    rect(c, 0, h / 2, w, h / 2, '#d52b1e');
    rect(c, 0, 0, h / 2, h / 2, '#0039a6');
    star(c, h / 4, h / 4, h * 0.13, '#ffffff');
  },
  peru: (c, w, h) => vBands(c, w, h, ['#d91023', '#ffffff', '#d91023']),

  // Europe
  francia: (c, w, h) => vBands(c, w, h, ['#002395', '#ffffff', '#ed2939']),
  alemania: (c, w, h) => hBands(c, w, h, ['#1d1d1d', '#dd0000', '#ffce00']),
  espana: (c, w, h) => {
    hBands(c, w, h, ['#c60b1e', '#ffc400', '#c60b1e'], [1, 2, 1]);
    emblem(c, w * 0.32, h / 2, h * 0.12, '#c60b1e', '#8a6d00');
  },
  inglaterra: (c, w, h) => {
    rect(c, 0, 0, w, h, '#ffffff');
    centredCross(c, w, h, '#ce1124', 0.2);
  },
  italia: (c, w, h) => vBands(c, w, h, ['#009246', '#ffffff', '#ce2b37']),
  portugal: (c, w, h) => {
    vBands(c, w, h, ['#006600', '#ff0000'], [2, 3]);
    emblem(c, w * 0.4, h / 2, h * 0.17, '#ffffff', '#ffcc00');
    emblem(c, w * 0.4, h / 2, h * 0.08, '#ff0000', '#ffffff');
  },
  paisesbajos: (c, w, h) => hBands(c, w, h, ['#ae1c28', '#ffffff', '#21468b']),
  belgica: (c, w, h) => vBands(c, w, h, ['#1d1d1d', '#fdda24', '#ef3340']),
  croacia: (c, w, h) => {
    hBands(c, w, h, ['#ff0000', '#ffffff', '#171796']);
    const sq = h * 0.07;
    const x0 = w / 2 - sq * 2.5;
    const y0 = h * 0.3;
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) rect(c, x0 + i * sq, y0 + j * sq, sq + 0.5, sq + 0.5, (i + j) % 2 ? '#ffffff' : '#ff0000');
    }
  },
  suiza: (c, w, h) => {
    rect(c, 0, 0, w, h, '#d52b1e');
    rect(c, w / 2 - h * 0.09, h * 0.2, h * 0.18, h * 0.6, '#ffffff');
    rect(c, w / 2 - h * 0.3, h / 2 - h * 0.09, h * 0.6, h * 0.18, '#ffffff');
  },
  dinamarca: (c, w, h) => {
    rect(c, 0, 0, w, h, '#c8102e');
    nordic(c, w, h, '#ffffff', 0.16);
  },
  austria: (c, w, h) => hBands(c, w, h, ['#ed2939', '#ffffff', '#ed2939']),
  polonia: (c, w, h) => hBands(c, w, h, ['#ffffff', '#dc143c']),
  serbia: (c, w, h) => {
    hBands(c, w, h, ['#c6363c', '#0c4076', '#ffffff']);
    emblem(c, w * 0.32, h * 0.46, h * 0.15, '#c6363c', '#e8c46a');
  },
  suecia: (c, w, h) => {
    rect(c, 0, 0, w, h, '#006aa7');
    nordic(c, w, h, '#fecc00', 0.2);
  },
  turquia: (c, w, h) => {
    rect(c, 0, 0, w, h, '#e30a17');
    crescent(c, w * 0.4, h / 2, h * 0.25, '#ffffff', '#e30a17', 0.28);
    star(c, w * 0.56, h / 2, h * 0.1, '#ffffff', 5, 0.42, Math.PI);
  },

  // North and Central America
  mexico: (c, w, h) => {
    vBands(c, w, h, ['#006847', '#ffffff', '#ce1126']);
    emblem(c, w / 2, h / 2, h * 0.12, '#a0672c', '#006847');
  },
  eeuu: (c, w, h) => {
    const stripes = Array.from({ length: 13 }, (_, i) => (i % 2 ? '#ffffff' : '#b22234'));
    hBands(c, w, h, stripes);
    const cw = w * 0.42;
    const ch = (h * 7) / 13;
    rect(c, 0, 0, cw, ch, '#3c3b6e');
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 5; col++) {
        circle(c, cw * (0.13 + col * 0.185) + (row % 2) * cw * 0.09, ch * (0.16 + row * 0.23), h * 0.022, '#ffffff');
      }
    }
  },
  canada: (c, w, h) => {
    vBands(c, w, h, ['#d80621', '#ffffff', '#d80621'], [1, 2, 1]);
    star(c, w / 2, h * 0.47, h * 0.26, '#d80621', 11, 0.55);
    rect(c, w / 2 - h * 0.025, h * 0.6, h * 0.05, h * 0.22, '#d80621');
  },
  costarica: (c, w, h) => hBands(c, w, h, ['#002b7f', '#ffffff', '#ce1126', '#ffffff', '#002b7f'], [1, 1, 2, 1, 1]),
  panama: (c, w, h) => {
    rect(c, 0, 0, w / 2, h / 2, '#ffffff');
    rect(c, w / 2, 0, w / 2, h / 2, '#da121a');
    rect(c, 0, h / 2, w / 2, h / 2, '#072357');
    rect(c, w / 2, h / 2, w / 2, h / 2, '#ffffff');
    star(c, w / 4, h / 4, h * 0.13, '#072357');
    star(c, (w * 3) / 4, (h * 3) / 4, h * 0.13, '#da121a');
  },
  jamaica: (c, w, h) => {
    rect(c, 0, 0, w, h, '#009b3a');
    c.fillStyle = '#1d1d1d';
    c.beginPath();
    c.moveTo(0, 0); c.lineTo(w / 2, h / 2); c.lineTo(0, h); c.closePath(); c.fill();
    c.beginPath();
    c.moveTo(w, 0); c.lineTo(w / 2, h / 2); c.lineTo(w, h); c.closePath(); c.fill();
    diagonal(c, 0, 0, w, h, h * 0.16, '#fed100');
    diagonal(c, w, 0, 0, h, h * 0.16, '#fed100');
  },

  // Africa
  marruecos: (c, w, h) => {
    rect(c, 0, 0, w, h, '#c1272d');
    c.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
      c.lineTo(w / 2 + Math.cos(a) * h * 0.24, h / 2 + Math.sin(a) * h * 0.24);
    }
    c.closePath();
    c.lineWidth = h * 0.05;
    c.strokeStyle = '#006233';
    c.stroke();
  },
  senegal: (c, w, h) => {
    vBands(c, w, h, ['#00853f', '#fdef42', '#e31b23']);
    star(c, w / 2, h / 2, h * 0.16, '#00853f');
  },
  nigeria: (c, w, h) => vBands(c, w, h, ['#008751', '#ffffff', '#008751']),
  camerun: (c, w, h) => {
    vBands(c, w, h, ['#007a5e', '#ce1126', '#fcd116']);
    star(c, w / 2, h / 2, h * 0.15, '#fcd116');
  },
  egipto: (c, w, h) => {
    hBands(c, w, h, ['#ce1126', '#ffffff', '#1d1d1d']);
    emblem(c, w / 2, h / 2, h * 0.11, '#c09300', '#c09300');
  },
  ghana: (c, w, h) => {
    hBands(c, w, h, ['#ce1126', '#fcd116', '#006b3f']);
    star(c, w / 2, h / 2, h * 0.15, '#1d1d1d');
  },
  argelia: (c, w, h) => {
    vBands(c, w, h, ['#006233', '#ffffff']);
    crescent(c, w * 0.5, h / 2, h * 0.24, '#d21034', '#ffffff', 0.3);
    star(c, w * 0.58, h / 2, h * 0.09, '#d21034', 5, 0.42, Math.PI);
  },
  costamarfil: (c, w, h) => vBands(c, w, h, ['#ff8200', '#ffffff', '#009e60']),
  tunez: (c, w, h) => {
    rect(c, 0, 0, w, h, '#e70013');
    circle(c, w / 2, h / 2, h * 0.26, '#ffffff');
    crescent(c, w / 2, h / 2, h * 0.19, '#e70013', '#ffffff', 0.3);
    star(c, w / 2 + h * 0.06, h / 2, h * 0.08, '#e70013', 5, 0.42, Math.PI);
  },

  // Asia
  japon: (c, w, h) => {
    rect(c, 0, 0, w, h, '#ffffff');
    circle(c, w / 2, h / 2, h * 0.28, '#bc002d');
  },
  corea: (c, w, h) => {
    rect(c, 0, 0, w, h, '#ffffff');
    const r = h * 0.24;
    c.beginPath();
    c.arc(w / 2, h / 2, r, Math.PI, 0);
    c.fillStyle = '#cd2e3a';
    c.fill();
    c.beginPath();
    c.arc(w / 2, h / 2, r, 0, Math.PI);
    c.fillStyle = '#0047a0';
    c.fill();
    circle(c, w / 2 - r / 2, h / 2, r / 2, '#cd2e3a');
    circle(c, w / 2 + r / 2, h / 2, r / 2, '#0047a0');
    // Trigrams as little bars in the corners.
    for (const [x, y] of [[0.17, 0.2], [0.83, 0.2], [0.17, 0.8], [0.83, 0.8]]) {
      for (let k = 0; k < 3; k++) rect(c, w * x - h * 0.08, h * y - h * 0.08 + k * h * 0.06, h * 0.16, h * 0.035, '#1d1d1d');
    }
  },
  iran: (c, w, h) => {
    hBands(c, w, h, ['#239f40', '#ffffff', '#da0000']);
    emblem(c, w / 2, h / 2, h * 0.09, '#da0000', '#da0000');
  },
  australia: (c, w, h) => {
    rect(c, 0, 0, w, h, '#012169');
    unionJack(c, 0, 0, w / 2, h / 2);
    star(c, w * 0.25, h * 0.75, h * 0.12, '#ffffff', 7);
    for (const [x, y] of [[0.75, 0.25], [0.62, 0.48], [0.88, 0.42], [0.75, 0.8]]) star(c, w * x, h * y, h * 0.06, '#ffffff', 7);
  },
  arabia: (c, w, h) => {
    rect(c, 0, 0, w, h, '#006c35');
    // A white line of "script" and the sword.
    for (let i = 0; i < 6; i++) rect(c, w * (0.22 + i * 0.1), h * 0.3, w * 0.07, h * 0.1, '#ffffff');
    rect(c, w * 0.22, h * 0.62, w * 0.56, h * 0.05, '#ffffff');
  },
  qatar: (c, w, h) => {
    rect(c, 0, 0, w, h, '#8a1538');
    c.beginPath();
    c.moveTo(0, 0);
    const teeth = 9;
    for (let i = 0; i <= teeth * 2; i++) {
      const x = i % 2 ? w * 0.42 : w * 0.32;
      c.lineTo(x, (h * i) / (teeth * 2));
    }
    c.lineTo(0, h);
    c.closePath();
    c.fillStyle = '#ffffff';
    c.fill();
  },
  irak: (c, w, h) => {
    hBands(c, w, h, ['#ce1126', '#ffffff', '#1d1d1d']);
    for (let i = 0; i < 3; i++) rect(c, w * (0.36 + i * 0.1), h * 0.43, w * 0.07, h * 0.12, '#007a3d');
  },
  uzbekistan: (c, w, h) => {
    hBands(c, w, h, ['#0099b5', '#ce1126', '#ffffff', '#ce1126', '#1eb53a'], [10, 1, 10, 1, 10]);
    crescent(c, w * 0.14, h * 0.17, h * 0.1, '#ffffff', '#0099b5', 0.35);
    for (let i = 0; i < 4; i++) star(c, w * (0.26 + i * 0.07), h * 0.16, h * 0.025, '#ffffff');
  },

  // Oceania
  nzelanda: (c, w, h) => {
    rect(c, 0, 0, w, h, '#012169');
    unionJack(c, 0, 0, w / 2, h / 2);
    for (const [x, y] of [[0.75, 0.22], [0.66, 0.5], [0.85, 0.45], [0.75, 0.8]]) {
      star(c, w * x, h * y, h * 0.075, '#ffffff');
      star(c, w * x, h * y, h * 0.05, '#c8102e');
    }
  },
};
