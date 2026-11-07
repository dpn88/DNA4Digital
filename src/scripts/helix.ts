// The particle helix behind every page, turning into a circuit board in its lower part (an echo of the business
// card). It survives page navigations (the #stage element is persisted by
// Astro's ClientRouter) and moves the camera to the rung that belongs to the page being shown:
// home = the whole helix with the menu beside it; any other page = zoomed onto its rung, content panel open.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { navigate, type TransitionBeforePreparationEvent } from 'astro:transitions/client';
import { rungForPath } from '../data/site';
import { ROUTES, langFromPath } from '../i18n';
import { storedA11y } from './prefs';

declare global {
  interface Window { __helixReady?: boolean }
}

const root = document.documentElement;
const PHONE_MQ = matchMedia('(max-width: 819px)'); // keep in sync with global.css
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');
// The OS setting or the "Pause animations" accessibility option.
const reducedMotion = () => REDUCED.matches || root.classList.contains('a11y-still');
const LITE = PHONE_MQ.matches || (navigator.hardwareConcurrency || 8) <= 4;

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const ease = (t: number) => (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// Spin speed in radians per second (about 29 seconds per full turn).
const SPEED = 0.22;
const SPEED_REDUCED = 0.03;
// Wait this long after a click before swapping pages, so the old panel or hero can fade out.
const SWAP_DELAY_MS = 320;
// While a subpage scrolls, the camera moves down the helix by this many world units per screen height.
const DRIFT_PER_SCREEN = 0.55;

function start() {
  // "Turn off the 3D background" in the accessibility settings: keep the plain page.
  if (storedA11y().no3d) {
    root.classList.add('no-gl');
    return;
  }
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: !LITE, powerPreference: 'high-performance' });
  } catch {
    root.classList.add('no-gl');
    return;
  }
  const stage = document.getElementById('stage')!;
  const overlay = document.getElementById('overlay') as HTMLCanvasElement;
  const octx = overlay.getContext('2d')!;
  const PR = Math.min(window.devicePixelRatio, LITE ? 1.5 : 2);
  renderer.setPixelRatio(PR);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  stage.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  const TAN = Math.tan(THREE.MathUtils.degToRad(15));

  function makeBackground(phone: boolean) {
    const c = document.createElement('canvas');
    c.width = c.height = 1024;
    const g = c.getContext('2d')!;
    const px = (phone ? 0.3 : 0.66) * 1024, py = (phone ? 0.72 : 0.42) * 1024;
    const grd = g.createRadialGradient(px, py, 0, px, py, 900);
    grd.addColorStop(0, '#0f4357');
    grd.addColorStop(0.4, '#0a2b3a');
    grd.addColorStop(1, '#030d15');
    g.fillStyle = grd;
    g.fillRect(0, 0, 1024, 1024);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // ---------- Helix shape ----------
  const L = 10, R = 1.15, TURNS = 2.4, GROOVE = Math.PI;
  const BP = Math.round(TURNS * 10.5);
  const angAt = (t: number) => t * TURNS * Math.PI * 2;
  const yAt = (t: number) => L / 2 - t * L;
  const strandPoint = (t: number, off: number) => { const a = angAt(t) + off; return [R * Math.cos(a), yAt(t), R * Math.sin(a)]; };
  const rungY = Array.from({ length: BP }, (_, j) => yAt((j + .5) / BP));

  // Below "Selected work" the helix turns into a circuit printed all the way round its own cylinder, which
  // spins with it. Every particle has a place on the helix and a place on the board; through the morph zone (Z_TOP
  // down to Z_BOT) the shader blends from one to the other, so the strands stay joined while the fuzz clears and the
  // circuit forms.
  const Z_TOP = .3, Z_BOT = -1.35, T_END = (L / 2 - Z_BOT) / L;
  const morphAt = (y: number) => smooth(Z_TOP, Z_BOT, y);

  // The board is laid out unrolled: u runs round the tube (arc length at radius R, wrapping at CIRC) and y runs down
  // it. u = 0 is where strand A is at the bottom of the zone; strand B is half way round.
  const CIRC = 2 * Math.PI * R, HALF = CIRC / 2, PHI0 = angAt(T_END);
  // Below the chips the tube narrows, so the traces draw together towards the bottom.
  const boardR = (y: number) => R * (1 - .45 * smooth(-2.4, -5, y));
  type V3 = [number, number, number];
  const wrap = (u: number, y: number): V3 => { const a = PHI0 + u / R, r = boardR(y); return [r * Math.cos(a), y, r * Math.sin(a)]; };
  // Inside the zone a strand's board path simply follows the helix (strand A; B is HALF further round).
  const helixU = (y: number) => (Z_BOT - y) * TURNS * Math.PI * 2 / L * R;

  // Particle shapes drawn by the fragment shader.
  const ROUND = 0, SQUARE = 1, RING = 2;
  const P: number[] = [], BOARD: number[] = [], MIX: number[] = [], SIZE: number[] = [], BRIGHT: number[] = [], PHASE: number[] = [];
  const RUNG: number[] = [], COL: number[] = [], SHAPE: number[] = [], FLOW: number[] = [];
  const cA = new THREE.Color(0x27d6d0), cB = new THREE.Color(0x1ab0f0), cRung = new THREE.Color(0x7fe4f6), cHalo = new THREE.Color(0x1fa9d0);
  // Board colours: each strand keeps its own hue, a little paler, so the colour carries on from the helix.
  const pale = new THREE.Color(0xc6eef6);
  const cBA = cA.clone().lerp(pale, .4), cBB = cB.clone().lerp(pale, .4), cTrace = cA.clone().lerp(cB, .5).lerp(pale, .4);
  const cFaint = cTrace.clone().multiplyScalar(.6);
  const lerpC = (a: THREE.Color, b: THREE.Color, t: number) => a.clone().lerp(b, t);
  // Round the tube the colour drifts between the two strands' hues.
  const colAt = (u: number) => lerpC(cBA, cBB, .5 + .5 * Math.cos(u / R));
  function add(h: V3, b: V3, mix: number, size: number, bright: number, rung: number, col: THREE.Color, shape = ROUND, flow = -1) {
    P.push(h[0], h[1], h[2]); BOARD.push(b[0], b[1], b[2]); MIX.push(mix);
    SIZE.push(size); BRIGHT.push(bright); PHASE.push(Math.random()); RUNG.push(rung); SHAPE.push(shape); FLOW.push(flow);
    const j = 0.88 + Math.random() * 0.24;
    COL.push(col.r * j, col.g * j, col.b * j);
  }
  // A particle that only lives on the board.
  const addB = (u: number, y: number, size: number, bright: number, rung: number, col: THREE.Color, shape = ROUND, flow = -1) =>
    { const b = wrap(u, y); add(b, b, 1, size, bright, rung, col, shape, flow); };
  // Circuit traces are drawn as soft lines (see lineMat), one piece per short straight chord of the tube, instead of
  // rows of overlapping dots: about a sixth as many things to draw, and they stay solid when the camera zooms in.
  const LA: number[] = [], LB: number[] = [], LW: number[] = [], LBR: number[] = [], LR: number[] = [], LC: number[] = [], LFA: number[] = [], LFB: number[] = [];
  // At this gain a line glows like the row of dots it replaced (worked out from the dots' size, spacing and falloff,
  // then checked against screenshots of the dotted version).
  const LINE_GAIN = .86;
  function line(u0: number, y0: number, u1: number, y1: number, bright: number, rung: number, col: THREE.Color, flowA = -1, flowB = -1) {
    LA.push(...wrap(u0, y0)); LB.push(...wrap(u1, y1)); LW.push(.48); LBR.push(bright * LINE_GAIN); LR.push(rung);
    LC.push(col.r, col.g, col.b); LFA.push(flowA); LFB.push(flowB);
  }

  // Strands: a dense core plus a fuzzy outer layer. In the zone each particle also gets its board spot, the fuzz
  // goes, and the strand thins out to the density of a trace.
  for (const [off, col, uOff, bcol] of [[0, cA, 0, cBA], [GROOVE, cB, HALF, cBB]] as const) {
    const n = Math.round((LITE ? 1700 : 2800) * T_END);
    for (let i = 0; i < n; i++) {
      const t = Math.random() * T_END, [x, y, z] = strandPoint(t, off), w = morphAt(y);
      if (Math.random() < w * .75) continue;
      const fuzzy = Math.random() < 0.3, s = fuzzy ? 0.17 : 0.065;
      const size = 0.5 + Math.random() * (fuzzy ? 0.7 : 1.1), bright = fuzzy ? 0.35 + Math.random() * 0.35 : 0.55 + Math.random() * 0.45;
      add([x + gauss() * s, y + gauss() * s * 0.6, z + gauss() * s], wrap(helixU(y) + uOff + gauss() * .008, y), w,
        size + (.5 - size) * w, bright + (.4 - bright) * w, -1, lerpC(col, bcol, w), ROUND, L / 2 - y);
    }
  }

  // Rungs: thin dotted lines between the strands. Through the zone each one opens out into a dashed half ring round
  // the tube, and the other half of the ring fades in, so the rungs end up as full rings.
  const RUNG_DOTS = LITE ? 32 : 46;
  const lastRung = rungY.findIndex(y => y < Z_BOT) - 1;
  const dashGap = (u: number) => ((((u % .17) + .17) % .17) / .17 > .62 ? 1 : 0);
  for (let j = 0; j <= lastRung; j++) {
    const t = (j + .5) / BP, a = strandPoint(t, 0), b = strandPoint(t, GROOVE), y = rungY[j], w = morphAt(y), u0 = helixU(y);
    for (let k = 1; k < RUNG_DOTS; k++) {
      const f = k / RUNG_DOTS, u = u0 + HALF * f;
      add([a[0] + (b[0] - a[0]) * f + gauss() * .012, a[1] + gauss() * .012, a[2] + (b[2] - a[2]) * f + gauss() * .012], wrap(u, y), w,
        0.55 + Math.random() * 0.4 - .1 * w, (0.75 + Math.random() * 0.25) * (1 - w * dashGap(u)) * (1 - .35 * w), j, cRung);
    }
    const fade = Math.pow(w, 1.5);
    if (fade < .03) continue;
    const first = Math.ceil((u0 + HALF) / .17) * .17;
    for (let u = first; u < u0 + CIRC - .02; u += .17) line(u, y, Math.min(u + .105, u0 + CIRC), y, .5 * fade, j, cRung);
  }

  // Loose halo particles drifting around the strands, thinning out through the zone.
  for (let i = 0; i < Math.round((LITE ? 450 : 800) * T_END); i++) {
    const t = Math.random() * T_END, [x, y, z] = strandPoint(t, Math.random() < .5 ? 0 : GROOVE), w = morphAt(y);
    const h: V3 = [x + gauss() * .38, y + gauss() * .3, z + gauss() * .38];
    add(h, h, 0, 0.4 + Math.random() * 0.6, (0.18 + Math.random() * 0.22) * (1 - w), -1, cHalo);
  }

  // ---------- Circuit board ----------
  // Traces are rows of fine dots; pads, chips and terminals use the square and ring shapes. The upper board keeps a
  // little loose dust, so the helix's texture dies away gradually. aFlow is the distance down from the top of the
  // helix, which carries the signal pulses all the way down.
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  type Pt = [number, number]; // [u, y]
  const STEP = LITE ? .02 : .012, DIM = STEP / .02;
  const fadeIn = (y: number) => Math.pow(morphAt(y), 1.5);

  // A coarse occupancy grid over the unrolled board, so generated traces and parts don't run into each other.
  const CELL = .06, GW = Math.ceil(CIRC / CELL), GH = Math.ceil(6.5 / CELL);
  const occ = new Uint8Array(GW * GH);
  const cellOf = (u: number, y: number) => {
    const i = ((Math.floor(u / CELL) % GW) + GW) % GW, j = Math.floor((1 - y) / CELL);
    return j >= 0 && j < GH ? j * GW + i : -1;
  };
  const isFree = (u: number, y: number) => { const c = cellOf(u, y); return c >= 0 && !occ[c]; };
  const claim = (u: number, y: number, pad = 1) => {
    for (let di = -pad; di <= pad; di++) for (let dj = -pad; dj <= pad; dj++) { const c = cellOf(u + di * CELL, y + dj * CELL); if (c >= 0) occ[c] = 1; }
  };
  const walk = (pts: Pt[], fn: (u: number, y: number) => boolean | void) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [u0, y0] = pts[i], [u1, y1] = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(u1 - u0, y1 - y0) / (CELL * .5)));
      for (let k = 0; k <= n; k++) if (fn(u0 + (u1 - u0) * k / n, y0 + (y1 - y0) * k / n) === false) return false;
    }
    return true;
  };
  const pathFree = (pts: Pt[]) => walk(pts, (u, y) => isFree(u, y));
  const claimPath = (pts: Pt[]) => { walk(pts, (u, y) => { claim(u, y); }); };

  function trace(pts: Pt[], flow0 = -1, o: { bright?: number; rung?: number; col?: THREE.Color; block?: boolean } = {}) {
    let flow = flow0;
    for (let i = 0; i < pts.length - 1; i++) {
      const [u0, y0] = pts[i], [u1, y1] = pts[i + 1], d = Math.hypot(u1 - u0, y1 - y0);
      // Chords short enough that the tube's curve and taper never show.
      const n = Math.max(1, Math.ceil(Math.max(Math.abs(u1 - u0) / .1, Math.abs(y1 - y0) / .3)));
      for (let k = 0; k < n; k++) {
        const fa = k / n, fb = (k + 1) / n, ya = y0 + (y1 - y0) * fa, yb = y0 + (y1 - y0) * fb, fade = fadeIn((ya + yb) / 2);
        if (fade <= .01) continue;
        const ua = u0 + (u1 - u0) * fa, ub = u0 + (u1 - u0) * fb;
        line(ua, ya, ub, yb, (o.bright ?? .32) * fade, o.rung ?? -1, o.col ?? colAt((ua + ub) / 2),
          flow0 >= 0 ? flow + d * fa : -1, flow0 >= 0 ? flow + d * fb : -1);
      }
      for (let s = 0; s < d; s += .02) {
        const u = u0 + (u1 - u0) * s / d, y = y0 + (y1 - y0) * s / d;
        if (Math.random() < .3 * (1 - smooth(Z_BOT, -3.2, y))) addB(u + gauss() * .05, y + gauss() * .05, .4 + Math.random() * .5, .2 * fadeIn(y), -1, o.col ?? colAt(u));
      }
      flow += d;
    }
    if (o.block !== false) claimPath(pts);
    return flow;
  }
  // Pads and terminals shrink a little where the tube narrows, so they don't crowd together at the bottom.
  const pad = (u: number, y: number, size = 1.5, flow = -1, rung = -1, col?: THREE.Color) => {
    addB(u, y, size * (.5 + .5 * boardR(y) / R), .72 * fadeIn(y), rung, lerpC(col ?? colAt(u), pale, .5), SQUARE, flow); claim(u, y);
  };
  const ring = (u: number, y: number, size = 2.4, flow = -1, col?: THREE.Color) => {
    addB(u, y, size * (.5 + .5 * boardR(y) / R), .7, -1, lerpC(col ?? colAt(u), pale, .5), RING, flow); claim(u, y, 2);
  };
  function padsAlong(pts: Pt[], flow0: number, every: number, col?: THREE.Color, size = 1.4) {
    let carry = every * .5, flow = flow0;
    for (let i = 0; i < pts.length - 1; i++) {
      const [u0, y0] = pts[i], [u1, y1] = pts[i + 1], d = Math.hypot(u1 - u0, y1 - y0);
      let s = carry;
      for (; s < d; s += every) pad(u0 + (u1 - u0) * s / d, y0 + (y1 - y0) * s / d, size, flow + s, -1, col);
      carry = s - d;
      flow += d;
    }
  }
  // A ring of dashes with small square pads round the whole tube. Traces may cross it, as on the card.
  function dashedRing(y: number, rung = -1) {
    let u = rnd() * .2;
    while (u < CIRC) {
      if (rnd() < .22) { addB(u + .025, y, .85, .72 * fadeIn(y), rung, lerpC(colAt(u), pale, .5), SQUARE); u += .09; continue; }
      const len = .06 + rnd() * .16;
      trace([[u, y], [Math.min(u + len, CIRC), y]], -1, { bright: .36, rung, block: false });
      u += len + .05;
    }
  }
  // A chip: outline, pins on every side, and the strands' X picked out in small squares inside.
  function chip(uc: number, yc: number, h: number, col: THREE.Color, skipY: number[] = []) {
    trace([[uc - h, yc + h], [uc + h, yc + h], [uc + h, yc - h], [uc - h, yc - h], [uc - h, yc + h]], -1, { bright: .5, col: lerpC(col, pale, .4) });
    const n = h > .25 ? 4 : 3;
    for (let i = 0; i < n; i++) {
      const o = -h + (i + .5) * 2 * h / n;
      for (const s of [-1, 1]) {
        trace([[uc + o, yc + s * h], [uc + o, yc + s * (h + .06)]], -1, { bright: .3, col });
        addB(uc + o, yc + s * (h + .08), .7, .6, -1, lerpC(col, pale, .5), SQUARE);
        if (skipY.some(y => Math.abs(yc + o - y) < .07)) continue;
        trace([[uc + s * h, yc + o], [uc + s * (h + .06), yc + o]], -1, { bright: .3, col });
        addB(uc + s * (h + .08), yc + o, .7, .6, -1, lerpC(col, pale, .5), SQUARE);
      }
    }
    for (let i = -3; i <= 3; i++) {
      const o = i * h * .24;
      addB(uc + o, yc + o, .65, .6, -1, lerpC(cBA, pale, .3), SQUARE);
      if (i) addB(uc + o, yc - o, .65, .6, -1, lerpC(cBB, pale, .3), SQUARE);
    }
    for (let u = uc - h - .1; u <= uc + h + .1; u += CELL) for (let y = yc - h - .1; y <= yc + h + .1; y += CELL) claim(u, y, 0);
  }
  const footprint = (uc: number, yc: number, cols: number, rows: number) => {
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) addB(uc + (i - (cols - 1) / 2) * .055, yc + (j - (rows - 1) / 2) * .055, .7, .45, -1, cFaint, SQUARE);
  };
  const bars = (uc: number, yc: number) => { for (let i = 0; i < 3; i++) trace([[uc - .07 + i * .02, yc + i * .045], [uc + .07, yc + i * .045]], -1, { bright: .24, col: cFaint }); };

  // The upper part of a strand's board path grows out of the strand itself: each dot and pad starts on the strand
  // (at the same height) and settles onto the path, showing up only as the strand clears.
  function strandPath(off: number, uOff: number, hcol: THREE.Color, col: THREE.Color, flow0: number, every = .27) {
    let nextPad = every * .5;
    const n = Math.round((Z_TOP - Z_BOT) / STEP);
    for (let k = 0; k <= n; k++) {
      const y = Z_TOP - (Z_TOP - Z_BOT) * k / n, w = morphAt(y);
      if (w < .02) continue;
      const h = strandPoint((L / 2 - y) / L, off) as V3, b = wrap(helixU(y) + uOff, y);
      add(h, b, w, .42 + rnd() * .12, .42 * DIM * Math.pow(w, 1.3), -1, lerpC(hcol, col, w), ROUND, flow0 + (Z_TOP - y));
      const s = (Z_TOP - y) * 1.6; // rough path length so far
      if (s >= nextPad) { nextPad += every; if (w > .05) add(h, b, w, 1.4, .72 * w * w, -1, lerpC(col, pale, .5), SQUARE, flow0 + (Z_TOP - y)); }
    }
  }

  // The two strands. Each keeps winding round the tube as a stepped trace into its own chip (A and B sit on opposite
  // sides), carries on out of the chip's far corner and splits into a fan of traces ending in terminals.
  const CHIP_Y = -2.05, CHIP_H = .3, CHIP_U = .62, BLOG_RUNG = 17, CONTACT_RUNG = 22;
  const BLOG_Y = rungY[BLOG_RUNG], CONTACT_Y = rungY[CONTACT_RUNG];
  for (const [off, uOff, hcol, col] of [[0, 0, cA, cBA], [GROOVE, HALF, cB, cBB]] as const) {
    strandPath(off, uOff, hcol, col, L / 2 - Z_TOP);
    const f0 = L / 2 - Z_BOT;
    const into: Pt[] = [[uOff, Z_BOT], [uOff + CHIP_U - CHIP_H, CHIP_Y + CHIP_H]];
    const e1 = trace(into, f0, { bright: .44, col });
    padsAlong(into, f0, .27, col);
    chip(uOff + CHIP_U, CHIP_Y, CHIP_H, col, [BLOG_Y]);
    const ux = uOff + CHIP_U + CHIP_H, out: Pt[] = [[ux, CHIP_Y - CHIP_H], [ux + .4, CHIP_Y - CHIP_H - .4], [ux + .4, -3.0]];
    const e2 = trace(out, e1 + .85, { bright: .44, col });
    padsAlong(out.slice(0, 2), e1 + .85, .27, col);
    const uf = ux + .4;
    pad(uf, -3.0, 1.8, e2, -1, col);
    let e = trace([[uf, -3.0], [uf, -4.45]], e2, { col }); ring(uf, -4.45 - .09, 3.6, e, col);
    e = trace([[uf, -3.0], [uf - .2, -3.2], [uf - .2, -4.3]], e2, { col }); ring(uf - .2, -4.3 - .07, 2.6, e, col);
    e = trace([[uf, -3.0], [uf + .2, -3.2], [uf + .2, -3.75], [uf + .32, -3.87], [uf + .32, -4.6]], e2, { col }); ring(uf + .32, -4.6 - .07, 2.6, e, col);
  }

  // The Blog rung becomes a bus round the tube joining the two chips; the Contact rung and a few others become
  // dashed rings.
  for (const [from, to] of [[CHIP_U + CHIP_H, HALF + CHIP_U - CHIP_H], [HALF + CHIP_U + CHIP_H, CIRC + CHIP_U - CHIP_H]]) {
    const mid = (from + to) / 2, f0 = L / 2 - BLOG_Y;
    for (const [a, b] of [[from, mid], [to, mid]]) {
      trace([[a, BLOG_Y], [b, BLOG_Y]], f0, { rung: BLOG_RUNG, bright: .44, block: false });
      for (let u = Math.min(a, b) + .3; u < Math.max(a, b) - .1; u += .45) pad(u, BLOG_Y, 1.1, -1, BLOG_RUNG);
    }
  }
  dashedRing(rungY[20]); dashedRing(CONTACT_Y, CONTACT_RUNG); dashedRing(rungY[16]);

  // Two smaller chips a quarter turn round, hanging off the Blog bus, with their own terminals below.
  for (const uc of [CHIP_U + CIRC / 4, CHIP_U + CIRC / 4 + HALF]) {
    const yc = rungY[20], h = .22, col = colAt(uc);
    chip(uc, yc, h, col, [yc]);
    for (const du of [-.1, .1]) trace([[uc + du, BLOG_Y], [uc + du, yc + h + .1]], L / 2 - BLOG_Y, { col });
    for (const [du, jog, end] of [[-.12, -.18, -4.25], [0, 0, -4.6], [.12, .18, -4.4]]) {
      const pts: Pt[] = [[uc + du, yc - h - .1], [uc + du, yc - h - .25], [uc + du + jog, yc - h - .25 - Math.abs(jog)], [uc + du + jog, end]];
      const e = trace(pts, L / 2 - yc, { col });
      ring(uc + du + jog, end - .07, jog ? 2.4 : 3.2, e, col);
    }
  }

  // Fill the rest of the tube with generated traces in lanes all the way round: drops from the Blog bus or from vias
  // down to terminals near the bottom, short links above the bus, each with an occasional 45 degree jog.
  const LANES = LITE ? 30 : 44;
  for (let k = 0; k < LANES; k++) {
    const u = k * CIRC / LANES + .03 + rnd() * .04, col = colAt(u);
    // A short link above the bus.
    if (rnd() < .55) {
      const ys = -1.45 - rnd() * .2, pts: Pt[] = [[u, ys], [u, BLOG_Y + .04]];
      if (pathFree(pts)) { trace(pts, L / 2 - ys, { col, bright: .28 }); ring(u, ys + .06, 1.8, -1, col); }
    }
    // A long drop to a terminal.
    const fromBus = rnd() < .45, ys = fromBus ? BLOG_Y - .03 : -2.3 - rnd() * 1.2;
    let ye = -4.0 - rnd() * .65;
    const jogAt = ys - .25 - rnd() * Math.max(.1, ys - ye - .8), du = rnd() < .5 ? 0 : (rnd() < .5 ? -1 : 1) * CIRC / LANES;
    let pts: Pt[] = du ? [[u, ys], [u, jogAt], [u + du, jogAt - Math.abs(du)], [u + du, ye]] : [[u, ys], [u, ye]];
    if (!pathFree(pts.map(([a, b], i) => (i === 0 ? [a, b - .08] : [a, b]) as Pt))) {
      // Shorten it to end before whatever is in the way.
      let stop = ys;
      walk(pts, (a, b) => { if (b < ys - .08 && !isFree(a, b)) return false; stop = b; });
      ye = stop + .14;
      if (ys - ye < .45) continue;
      pts = du && ye < jogAt - Math.abs(du) ? [[u, ys], [u, jogAt], [u + du, jogAt - Math.abs(du)], [u + du, ye]] : [[u, ys], [u, Math.max(ye, jogAt)]];
      ye = pts[pts.length - 1][1];
    }
    const e = trace(pts, L / 2 - ys, { col, bright: .3 });
    const ue = pts[pts.length - 1][0];
    if (!fromBus) pad(u, ys, 1.1, -1, -1, col);
    ring(ue, ye - .06, ye < -4.3 && rnd() < .3 ? 3.2 : 2.2, e, col);
  }

  // Small parts scattered in the gaps.
  for (let i = 0, placed = 0; i < 200 && placed < (LITE ? 14 : 24); i++) {
    const u = rnd() * CIRC, y = -1.5 - rnd() * 3.3, kind = rnd();
    const cols = kind < .5 ? 2 : 3, rows = kind < .5 ? 3 : 2;
    const box: Pt[] = [[u - .1, y + .1], [u + .1, y + .1], [u + .1, y - .1], [u - .1, y - .1]];
    if (!box.every(([a, b]) => isFree(a, b)) || !isFree(u, y)) continue;
    if (kind < .8) footprint(u, y, cols, rows); else bars(u, y);
    claim(u, y, 2);
    placed++;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('aBoard', new THREE.Float32BufferAttribute(BOARD, 3));
  geo.setAttribute('aMix', new THREE.Float32BufferAttribute(MIX, 1));
  geo.setAttribute('aSize', new THREE.Float32BufferAttribute(SIZE, 1));
  geo.setAttribute('aBright', new THREE.Float32BufferAttribute(BRIGHT, 1));
  geo.setAttribute('aPhase', new THREE.Float32BufferAttribute(PHASE, 1));
  geo.setAttribute('aRung', new THREE.Float32BufferAttribute(RUNG, 1));
  geo.setAttribute('aColor', new THREE.Float32BufferAttribute(COL, 3));
  geo.setAttribute('aShape', new THREE.Float32BufferAttribute(SHAPE, 1));
  geo.setAttribute('aFlow', new THREE.Float32BufferAttribute(FLOW, 1));

  const uniforms = {
    uTime: { value: 0 }, uPR: { value: PR }, uScale: { value: 110 }, uR: { value: R },
    uHL: { value: -1 }, uHLY: { value: 999 }, uPulse: { value: 1 }, uSpin: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float aSize; attribute float aBright; attribute float aPhase; attribute float aRung; attribute vec3 aColor;
      attribute vec3 aBoard; attribute float aMix; attribute float aShape; attribute float aFlow;
      uniform float uTime, uPR, uScale, uR, uHL, uHLY, uPulse, uSpin;
      varying float vAlpha; varying float vWhite; varying vec3 vColor; varying float vShape;
      vec3 spin(vec3 v){ float c = cos(uSpin), s = sin(uSpin); return vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z); }
      void main(){
        // Blend from the helix spot to the board spot, then spin the result: helix and board turn as one.
        vec3 q = mix(position, aBoard, aMix);
        float wob = 1.0 - aMix;
        q.x += sin(uTime * .9 + aPhase * 6.283) * .012 * wob;
        q.z += cos(uTime * .7 + aPhase * 6.283) * .012 * wob;
        vec3 p = spin(q);
        vec4 world = modelMatrix * vec4(p, 1.0);
        float front = (clamp(world.z / uR, -1.0, 1.0) + 1.0) * .5;
        float tw = mix(.78 + .22 * sin(uTime * 1.6 + aPhase * 40.0), .96, aMix * .8);
        float hl = 0.0;
        if (uHL >= 0.0){
          if (aRung >= 0.0) hl = abs(aRung - uHL) < .5 ? 1.0 : 0.0;
          else { float dy = (position.y - uHLY) / .35; hl = exp(-dy * dy) * .7; }
        }
        float pulse = 0.0;
        if (aFlow >= 0.0) { float f = fract(aFlow / 2.6 - uTime * .2); f = min(f, 1.0 - f); pulse = exp(-f * f / .0005) * uPulse * mix(.5, 1.0, aMix); }
        // The board always has half its circuit turned away, so it gets a little more light and a softer back.
        float wrapped = aMix;
        vAlpha = aBright * tw * mix(mix(.2, .32, wrapped), 1.0, front) * (1.0 + .45 * wrapped) * (1.0 + hl * 1.6) * (1.0 + pulse * 2.5);
        vWhite = max(hl, pulse * .7);
        vColor = aColor;
        vShape = aShape;
        vec4 mv = viewMatrix * world;
        gl_PointSize = aSize * uPR * uScale * (1.0 + hl * mix(.7, .25, aMix) + pulse * .4) * mix(.75, 1.15, front) / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vAlpha; varying float vWhite; varying vec3 vColor; varying float vShape;
      void main(){
        vec2 q = gl_PointCoord - .5;
        float a, c;
        if (vShape < .5) {
          float d = length(q);
          if (d > .5) discard;
          float soft = smoothstep(.5, 0.0, d), core = smoothstep(.22, 0.0, d);
          a = soft * .55 + core * .45; c = core * .5;
        } else if (vShape < 1.5) {
          float m = max(abs(q.x), abs(q.y));
          float body = 1.0 - smoothstep(.26, .32, m);
          a = body * .9 + smoothstep(.5, .3, m) * .18; c = body * .3;
        } else {
          float d = length(q);
          if (d > .5) discard;
          float r = 1.0 - smoothstep(.035, .075, abs(d - .3));
          a = r * .95 + smoothstep(.5, .3, d) * .06; c = r * .25;
        }
        vec3 col = mix(vColor, vec3(1.0), c + vWhite * .6);
        gl_FragColor = vec4(col, a * vAlpha);
      }`,
  });

  // The helix leans inside a tilted parent; the spin itself is the uSpin uniform (see the vertex shader).
  const TILT_Z = -0.21, TILT_X = 0.1;
  const tilt = new THREE.Group();
  tilt.rotation.set(TILT_X, 0, TILT_Z);
  scene.add(tilt);
  const helix = new THREE.Points(geo, mat);
  helix.frustumCulled = false;
  tilt.add(helix);

  // The circuit's lines: one camera-facing strip per chord, as wide as a dot of the same size would be at that depth,
  // with the dots' soft falloff across it. Spin, depth shading, hover glow and pulses match the particles.
  const lineGeo = new THREE.InstancedBufferGeometry();
  lineGeo.setAttribute('corner', new THREE.Float32BufferAttribute([0, -1, 1, -1, 0, 1, 1, 1], 2));
  lineGeo.setIndex([0, 1, 2, 2, 1, 3]);
  for (const [name, arr, n] of [['aA', LA, 3], ['aB', LB, 3], ['aWidth', LW, 1], ['aBright', LBR, 1], ['aRung', LR, 1], ['aColor', LC, 3], ['aFlowA', LFA, 1], ['aFlowB', LFB, 1]] as const) {
    lineGeo.setAttribute(name, new THREE.InstancedBufferAttribute(new Float32Array(arr), n));
  }
  lineGeo.instanceCount = LW.length;
  const lineMat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute vec2 corner; attribute vec3 aA; attribute vec3 aB; attribute float aWidth; attribute float aBright;
      attribute float aRung; attribute vec3 aColor; attribute float aFlowA; attribute float aFlowB;
      uniform float uPR, uScale, uR, uHL, uHLY, uSpin; uniform vec2 uRes;
      varying float vAlpha; varying float vX; varying vec3 vColor; varying float vFlow; varying float vHL;
      vec3 spin(vec3 v){ float c = cos(uSpin), s = sin(uSpin); return vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z); }
      void main(){
        vec4 wa = modelMatrix * vec4(spin(aA), 1.0), wb = modelMatrix * vec4(spin(aB), 1.0);
        vec4 ma = viewMatrix * wa, mb = viewMatrix * wb;
        vec4 ca = projectionMatrix * ma, cb = projectionMatrix * mb;
        vec2 dir = (cb.xy / cb.w - ca.xy / ca.w) * uRes;
        float len = length(dir);
        dir = len > 1e-5 ? dir / len : vec2(1.0, 0.0);
        float t = corner.x;
        vec4 w = mix(wa, wb, t), m = mix(ma, mb, t), c = mix(ca, cb, t);
        float front = (clamp(w.z / uR, -1.0, 1.0) + 1.0) * .5, f = mix(.75, 1.15, front);
        float hl = 0.0;
        if (uHL >= 0.0){
          if (aRung >= 0.0) hl = abs(aRung - uHL) < .5 ? 1.0 : 0.0;
          else { float dy = (mix(aA.y, aB.y, t) - uHLY) / .35; hl = exp(-dy * dy) * .7; }
        }
        float px = aWidth * uPR * uScale * f * (1.0 + hl * .25) / -m.z;
        c.xy += vec2(-dir.y, dir.x) * corner.y * px / uRes * c.w;
        gl_Position = c;
        // Same light as a board particle: a softer back, a little extra glow, and wider (closer) means brighter.
        vAlpha = aBright * .92 * mix(.32, 1.0, front) * 1.45 * f * (1.0 + hl * 1.6);
        vX = corner.y; vColor = aColor; vHL = hl;
        vFlow = aFlowA >= 0.0 ? mix(aFlowA, aFlowB, t) : -1.0;
      }`,
    fragmentShader: `
      uniform float uTime, uPulse;
      varying float vAlpha; varying float vX; varying vec3 vColor; varying float vFlow; varying float vHL;
      void main(){
        float d = abs(vX) * .5;
        float soft = smoothstep(.5, 0.0, d), core = smoothstep(.22, 0.0, d);
        float pulse = 0.0;
        if (vFlow >= 0.0) { float fl = fract(vFlow / 2.6 - uTime * .2); fl = min(fl, 1.0 - fl); pulse = exp(-fl * fl / .0005) * uPulse; }
        vec3 col = mix(vColor, vec3(1.0), core * .5 + max(vHL, pulse * .7) * .6);
        gl_FragColor = vec4(col, (soft * .55 + core * .45) * vAlpha * (1.0 + pulse * 2.5));
      }`,
  });
  const lines = new THREE.Mesh(lineGeo, lineMat);
  lines.frustumCulled = false;
  tilt.add(lines);
  tilt.updateMatrixWorld(true);
  const rungWorld = rungY.map(y => tilt.localToWorld(new THREE.Vector3(0, y, 0)));
  const AXIS = new THREE.Vector3(0, 1, 0).applyQuaternion(tilt.quaternion);
  // The rung each menu item sits on, spread evenly down the helix.
  const MENU_ITEMS = 5;
  const LABELED = Array.from({ length: MENU_ITEMS }, (_, i) => Math.round((i + .5) * BP / MENU_ITEMS - .5));

  // ---------- Haze and bokeh ----------
  function radialTex(stops: [number, string][]) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d')!, r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    stops.forEach(([o, col]) => r.addColorStop(o, col));
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }
  const haze = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialTex([[0, 'rgba(40,190,230,.55)'], [.5, 'rgba(20,120,170,.18)'], [1, 'rgba(0,0,0,0)']]),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .55,
  }));
  haze.scale.set(6, 13, 1);
  haze.material.rotation = TILT_Z;
  haze.position.set(0, 0, -1.5);
  scene.add(haze);

  const bokehTex = radialTex([[0, 'rgba(255,255,255,.9)'], [.55, 'rgba(255,255,255,.55)'], [.75, 'rgba(255,255,255,.12)'], [1, 'rgba(255,255,255,0)']]);
  function bokehCloud(n: number, spreadX: number, spreadY: number, zMin: number, zMax: number, size: number, opacity: number) {
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - .5) * spreadX;
      pos[i * 3 + 1] = (Math.random() - .5) * spreadY;
      pos[i * 3 + 2] = zMin + Math.random() * (zMax - zMin);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ map: bokehTex, size, sizeAttenuation: true, transparent: true, opacity, color: 0x2bb8d8, depthWrite: false, blending: THREE.AdditiveBlending }));
  }
  const bokehBack = bokehCloud(45, 9, 14, -7, -2, .9, .16);
  const bokehNear = bokehCloud(14, 12, 12, 6, 12, 1.6, .07);
  const specks = bokehCloud(LITE ? 90 : 160, 30, 22, -10, 4, .07, .5);
  scene.add(bokehBack, bokehNear, specks);

  // ---------- Background network ----------
  // Drifting nodes link up when close, and each link also fades in and out on its own timer. Links are soft,
  // gently curving particle filaments with occasional signal pulses. The network fades out behind the headline
  // (and behind the content panel when zoomed in) so text stays calm.
  const NET_N = LITE ? 90 : 150, NET_MAX_D = 3.0, NET_LINKS = 2;
  const NET_BOX = { x0: -18, x1: 12, y0: -9.5, y1: 9.5, z0: -11, z1: -5 };
  const netPos = new Float32Array(NET_N * 3), netVel = new Float32Array(NET_N * 3);
  for (let i = 0; i < NET_N; i++) {
    netPos[i * 3] = NET_BOX.x0 + Math.random() * (NET_BOX.x1 - NET_BOX.x0);
    netPos[i * 3 + 1] = NET_BOX.y0 + Math.random() * (NET_BOX.y1 - NET_BOX.y0);
    netPos[i * 3 + 2] = NET_BOX.z0 + Math.random() * (NET_BOX.z1 - NET_BOX.z0);
    netVel[i * 3] = (Math.random() - .5) * .2;
    netVel[i * 3 + 1] = (Math.random() - .5) * .2;
    netVel[i * 3 + 2] = (Math.random() - .5) * .05;
  }

  const netMat = new THREE.ShaderMaterial({
    uniforms: { uPR: { value: PR }, uScale: { value: 110 }, uColor: { value: new THREE.Color(0x52d0ea) } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float aAlpha; attribute float aSize;
      uniform float uPR, uScale;
      varying float vA;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vA = aAlpha;
        gl_PointSize = aSize * uPR * uScale / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vA;
      void main(){
        float d = length(gl_PointCoord - .5);
        if (d > .5) discard;
        float soft = smoothstep(.5, 0.0, d), core = smoothstep(.2, 0.0, d);
        gl_FragColor = vec4(mix(uColor, vec3(1.0), core * .4), (soft * .6 + core * .4) * vA);
      }`,
  });

  const nodeAlpha = new Float32Array(NET_N), nodeSize = new Float32Array(NET_N).fill(1.6);
  const netNodesGeo = new THREE.BufferGeometry();
  netNodesGeo.setAttribute('position', new THREE.BufferAttribute(netPos, 3).setUsage(THREE.DynamicDrawUsage));
  netNodesGeo.setAttribute('aAlpha', new THREE.BufferAttribute(nodeAlpha, 1).setUsage(THREE.DynamicDrawUsage));
  netNodesGeo.setAttribute('aSize', new THREE.BufferAttribute(nodeSize, 1));
  const netNodes = new THREE.Points(netNodesGeo, netMat);
  netNodes.frustumCulled = false;

  const NET_MAX_SEG = NET_N * NET_LINKS, FIL_PER = 52, FIL_MAX = NET_MAX_SEG * FIL_PER, FIL_STEP = LITE ? .08 : .06;
  const filPos = new Float32Array(FIL_MAX * 3), filAlpha = new Float32Array(FIL_MAX), filSize = new Float32Array(FIL_MAX);
  const filGeo = new THREE.BufferGeometry();
  filGeo.setAttribute('position', new THREE.BufferAttribute(filPos, 3).setUsage(THREE.DynamicDrawUsage));
  filGeo.setAttribute('aAlpha', new THREE.BufferAttribute(filAlpha, 1).setUsage(THREE.DynamicDrawUsage));
  filGeo.setAttribute('aSize', new THREE.BufferAttribute(filSize, 1).setUsage(THREE.DynamicDrawUsage));
  const filaments = new THREE.Points(filGeo, netMat);
  filaments.frustumCulled = false;
  scene.add(filaments, netNodes);

  const linkCount = new Uint8Array(NET_N);
  const calm = new Float32Array(NET_N);
  const pairPhase = (i: number, j: number) => { const s = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453; return (s - Math.floor(s)) * 6.283; };
  const netTmp = new THREE.Vector3();

  function updateNetwork(dt: number, time: number, zoomProg: number, phone: boolean, pulses: boolean, panelX: number) {
    for (let i = 0; i < NET_N; i++) {
      for (let k = 0; k < 3; k++) {
        const idx = i * 3 + k, maxV = k === 2 ? .05 : .22;
        netVel[idx] = clamp(netVel[idx] + (Math.random() - .5) * (k === 2 ? .12 : .45) * dt, -maxV, maxV);
        netPos[idx] += netVel[idx] * dt;
        const lo = k === 0 ? NET_BOX.x0 : k === 1 ? NET_BOX.y0 : NET_BOX.z0;
        const hi = k === 0 ? NET_BOX.x1 : k === 1 ? NET_BOX.y1 : NET_BOX.z1;
        if (netPos[idx] < lo || netPos[idx] > hi) { netVel[idx] *= -1; netPos[idx] = clamp(netPos[idx], lo, hi); }
      }
      // Calm factor from where the node sits on screen: quiet behind the headline at home, quiet behind the panel when zoomed.
      netTmp.set(netPos[i * 3], netPos[i * 3 + 1], netPos[i * 3 + 2]).project(camera);
      const fx = (netTmp.x + 1) / 2, fy = (1 - netTmp.y) / 2;
      const calmHome = phone ? smooth(.4, .6, fy) : smooth(.3, .62, fx);
      const calmZoom = 1 - .9 * (phone ? smooth(.3, .5, fy) : smooth(panelX - .04, panelX + .14, fx));
      calm[i] = calmHome + (calmZoom - calmHome) * zoomProg;
      nodeAlpha[i] = .06 + .8 * calm[i];
    }
    netNodesGeo.attributes.position.needsUpdate = true;
    netNodesGeo.attributes.aAlpha.needsUpdate = true;

    linkCount.fill(0);
    let s = 0, p = 0;
    const maxD2 = NET_MAX_D * NET_MAX_D;
    for (let i = 0; i < NET_N && s < NET_MAX_SEG; i++) {
      if (linkCount[i] >= NET_LINKS) continue;
      for (let j = i + 1; j < NET_N && s < NET_MAX_SEG; j++) {
        if (linkCount[j] >= NET_LINKS) continue;
        const x0 = netPos[i * 3], y0 = netPos[i * 3 + 1], z0 = netPos[i * 3 + 2];
        const x1 = netPos[j * 3], y1 = netPos[j * 3 + 1], z1 = netPos[j * 3 + 2];
        const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > maxD2) continue;
        const phase = pairPhase(i, j);
        const flick = clamp((Math.sin(time * .25 + phase) + .1) / .5, 0, 1);
        if (flick <= 0) continue;
        linkCount[i]++; linkCount[j]++; s++;
        const d = Math.sqrt(d2);
        const a = (1 - d / NET_MAX_D) * .5 * flick * (calm[i] + calm[j]) * .5;
        if (a > .005) {
          // Gentle bow that sways over time, plus a faint ripple along the strand, both in the screen plane.
          const l2 = Math.hypot(dx, dy) || 1, px = -dy / l2, py = dx / l2;
          const bend = d * (.12 * Math.cos(phase) + .09 * Math.sin(time * .5 + phase));
          const cx = (x0 + x1) / 2 + px * bend, cy = (y0 + y1) / 2 + py * bend, cz = (z0 + z1) / 2;
          const hasPulse = pulses && phase / 6.283 < .35;
          const pulseT = (time * .18 + phase) % 1;
          const n = Math.max(8, Math.min(FIL_PER - 1, Math.round(d / FIL_STEP)));
          for (let k = 0; k <= n && p < FIL_MAX; k++) {
            const t = k / n, u = 1 - t, env = Math.sin(Math.PI * t);
            const ripple = .035 * env * Math.sin(t * 9.4 + time * .8 + phase);
            const pulse = hasPulse ? Math.exp(-Math.pow((t - pulseT) / .07, 2)) : 0;
            filPos[p * 3] = u * u * x0 + 2 * u * t * cx + t * t * x1 + px * ripple;
            filPos[p * 3 + 1] = u * u * y0 + 2 * u * t * cy + t * t * y1 + py * ripple;
            filPos[p * 3 + 2] = u * u * z0 + 2 * u * t * cz + t * t * z1;
            filAlpha[p] = a * (.35 + .65 * env) + a * pulse * 1.8;
            filSize[p] = .7 + pulse * .6;
            p++;
          }
        }
        if (linkCount[i] >= NET_LINKS) break;
      }
    }
    filGeo.setDrawRange(0, p);
    filGeo.attributes.position.needsUpdate = true;
    filGeo.attributes.aAlpha.needsUpdate = true;
    filGeo.attributes.aSize.needsUpdate = true;
  }

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.7, 0.3));
  composer.addPass(new OutputPass());

  // ---------- Route state ----------
  let links: HTMLAnchorElement[] = [];
  let hover = -1;
  let rung = -1; // rung the camera is heading for, -1 = home view
  let prog = 0, target = 0; // 0 = whole helix, 1 = zoomed onto a rung
  const focus = new THREE.Vector2(), focusTarget = new THREE.Vector2();
  let panelShow = false, ready = false, swapping = false, firstLoad = true;
  let scrolled = false, docked = false; // page scrolled at all; panel's page links scrolled under the top bar
  let pendingHash = '';
  let heroBottom = 0;
  let panelLeft = 0; // left edge of the content panel, as a fraction of the screen width
  let drift = 0; // how far the camera has moved down the helix while reading

  // The menu is persisted per language, so a language switch brings in a new set of links to position.
  function bindLinks() {
    const found = [...document.querySelectorAll<HTMLAnchorElement>('#rungs .rung-link')];
    if (found[0] === links[0]) return;
    links = found;
    links.forEach((a, i) => {
      const on = () => { hover = i; };
      const off = () => { if (hover === i) hover = -1; };
      a.addEventListener('mouseenter', on);
      a.addEventListener('focus', on);
      a.addEventListener('mouseleave', off);
      a.addEventListener('blur', off);
    });
  }
  bindLinks();

  // Astro replaces the attributes on <html> when it swaps pages, so state lives here and is re-applied.
  function applyState() {
    root.classList.add('js');
    root.classList.remove('no-gl');
    root.classList.toggle('zoomed', target === 1);
    root.classList.toggle('panel-show', panelShow);
    root.classList.toggle('ready', ready);
    root.classList.toggle('scrolled', scrolled);
    root.classList.toggle('docked', docked);
  }

  function readScroll() {
    const nav = document.querySelector('.panel-nav'), bar = document.querySelector('.topbar');
    scrolled = scrollY > 8;
    docked = !!nav && !!bar && nav.getBoundingClientRect().bottom < bar.getBoundingClientRect().bottom;
  }
  addEventListener('scroll', () => {
    const was = `${scrolled}${docked}`;
    readScroll();
    if (`${scrolled}${docked}` !== was) applyState();
  }, { passive: true });

  function setRoute(r: number) {
    rung = r;
    if (r >= 0) {
      target = 1;
      const w = rungWorld[LABELED[r]];
      focusTarget.set(w.x, w.y);
      if (prog < .05) focus.copy(focusTarget);
    } else {
      target = 0;
    }
  }

  function measureHero() {
    const hero = document.querySelector('.hero');
    if (hero && !root.classList.contains('zoomed')) heroBottom = hero.getBoundingClientRect().bottom;
  }

  // offsetLeft ignores the slide-in transform, so this works while the panel is still hidden.
  function measurePanel() {
    const panel = document.querySelector<HTMLElement>('main.panel');
    if (panel && W) panelLeft = panel.offsetLeft / W;
  }

  function scrollToHash() {
    if (!pendingHash) return;
    const el = document.getElementById(decodeURIComponent(pendingHash.slice(1)));
    pendingHash = '';
    el?.scrollIntoView({ block: 'start' });
  }

  document.addEventListener('astro:before-preparation', ev => {
    const e = ev as TransitionBeforePreparationEvent;
    swapping = true;
    panelShow = false;
    hover = -1;
    setRoute(rungForPath(e.to.pathname));
    applyState();
    const load = e.loader;
    const delay = reducedMotion() ? 0 : SWAP_DELAY_MS;
    e.loader = async () => { await Promise.all([load(), new Promise(r => setTimeout(r, delay))]); };
  });
  document.addEventListener('astro:after-swap', () => { bindLinks(); applyState(); });

  // Runs once when the scene starts and again after every navigation. Astro's first astro:page-load only
  // fires on window load, so calling it directly avoids a flash of the home view on deep links.
  let shownPath = '';
  function onPageLoad() {
    const main = document.getElementById('main');
    bindLinks();
    setRoute(main ? Number(main.dataset.rung ?? -1) : -1);
    if (firstLoad || reducedMotion()) { prog = target; focus.copy(focusTarget); }
    links.forEach((a, i) => (i === rung ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    if (shownPath && shownPath !== location.pathname && rung >= 0) main?.focus({ preventScroll: true });
    shownPath = location.pathname;
    pendingHash = location.hash;
    swapping = false;
    firstLoad = false;
    readScroll(); // a reload can restore a scrolled position without a scroll event
    applyState();
    measureHero();
    measurePanel();
    document.fonts?.ready.then(measureHero);
  }
  document.addEventListener('astro:page-load', onPageLoad);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && rung >= 0 && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) navigate(ROUTES.home[langFromPath(location.pathname)]);
  });

  // ---------- Layout ----------
  let W = 0, H = 0, bgPhone: boolean | null = null;
  function resize() {
    // The stage's own size, so the page scrollbar on subpages doesn't stretch the canvas.
    W = stage.clientWidth; H = stage.clientHeight;
    renderer.setSize(W, H, false);
    composer.setSize(W, H);
    renderer.getDrawingBufferSize(uniforms.uRes.value);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    // Keep particles the same size relative to the helix on any screen height.
    uniforms.uScale.value = netMat.uniforms.uScale.value = 110 * H / 800;
    const phone = PHONE_MQ.matches;
    if (bgPhone !== phone) {
      (scene.background as THREE.Texture | null)?.dispose();
      scene.background = makeBackground(phone);
      bgPhone = phone;
    }
    overlay.width = W * PR; overlay.height = H * PR;
    octx.setTransform(PR, 0, 0, PR, 0, 0);
    measureHero();
    measurePanel();
  }
  // The resize event runs before this frame's animation callbacks, so the cleared canvas is redrawn before it is
  // shown. A ResizeObserver would run after them and flash one empty frame on every resize.
  window.addEventListener('resize', resize);

  function layout() {
    const phone = PHONE_MQ.matches;
    // On phones the helix sits below the hero text, so it starts wherever the hero ends.
    const top = phone ? (heroBottom ? clamp(heroBottom + 14, H * .45, H * .62) : H * .57) : 100;
    const bottom = phone ? H - 34 : H - 56;
    const frac = (bottom - top) / H, zf = phone ? 2.6 : 3.0;
    // Zoomed on desktop, the helix axis sits a little left of the panel's edge so the panel covers its right
    // half. Until a panel has been measured, use the sizes from global.css (width min(1080px, 70vw), 4vw margin).
    const panelX = panelLeft || (W * .96 - Math.min(1080, W * .7)) / W;
    const zoomHalfW = (L + .6) / (frac * 2 * TAN) / zf * TAN * (W / H);
    return {
      phone, frac, zf, panelX,
      fx: phone ? .27 : Math.min(.64, (W - 310) / W),
      fy: (top + bottom) / 2 / H,
      fxz: phone ? .5 : panelX - R * .3 / (2 * zoomHalfW),
      fyz: phone ? .2 : .5,
    };
  }

  // The camera always looks straight down -z, so a world point lands on screen at a fraction we can solve for.
  function cameraFor(lay: ReturnType<typeof layout>, zoomed: boolean) {
    const aspect = W / H;
    const dHome = (L + .6) / (lay.frac * 2 * TAN);
    if (!zoomed) {
      const hh = dHome * TAN, hw = hh * aspect;
      return new THREE.Vector3(-(lay.fx - .5) * 2 * hw, (lay.fy - .5) * 2 * hh, dHome);
    }
    const d = dHome / lay.zf, hh = d * TAN, hw = hh * aspect;
    const fx = focus.x - AXIS.x * drift, fy = focus.y - AXIS.y * drift;
    return new THREE.Vector3(fx - (lay.fxz - .5) * 2 * hw, fy + (lay.fyz - .5) * 2 * hh, d);
  }

  const tmp = new THREE.Vector3();
  function toScreen(x: number, y: number, z: number) {
    tmp.set(x, y, z).project(camera);
    return { x: (tmp.x + 1) / 2 * W, y: (1 - tmp.y) / 2 * H };
  }

  let lastFrame = performance.now();
  function loop(now = performance.now()) {
    requestAnimationFrame(loop);
    const dt = Math.min((now - lastFrame) / 1000, .05);
    lastFrame = now;
    if (!W || !H) return;
    const reduced = reducedMotion();
    // "Pause animations" freezes the scene completely; the OS reduced-motion setting only slows it down.
    const paused = root.classList.contains('a11y-still');
    const lay = layout();
    if (!paused) {
      uniforms.uTime.value += dt;
      updateNetwork(dt, uniforms.uTime.value, ease(prog), lay.phone, !reduced, lay.panelX);
      uniforms.uSpin.value += dt * (reduced ? SPEED_REDUCED : SPEED) * (target === 1 ? .35 : hover >= 0 ? .25 : 1);
      specks.rotation.y += dt * .01;
      bokehBack.rotation.y -= dt * .015;
    }
    const k = reduced ? 1 : 1 - Math.exp(-dt * 3.2);
    prog += (target - prog) * k;
    focus.lerp(focusTarget, k);
    // Scroll-linked drift down the strand, stopping a little before its end. Off with reduced motion.
    const room = rung >= 0 ? Math.max(0, rungY[LABELED[rung]] + L / 2 - 1.2) : 0;
    const driftTarget = target === 1 && !reduced ? Math.min(scrollY / H * DRIFT_PER_SCREEN, room) : 0;
    drift += (driftTarget - drift) * (1 - Math.exp(-dt * 4));

    const hlIdx = target === 1 && rung >= 0 ? LABELED[rung] : hover >= 0 ? LABELED[hover] : -1;
    uniforms.uHL.value = hlIdx;
    uniforms.uPulse.value = reduced ? 0 : 1;
    uniforms.uHLY.value = hlIdx >= 0 ? rungY[hlIdx] : 999;

    camera.position.lerpVectors(cameraFor(lay, false), cameraFor(lay, true), ease(prog));
    camera.lookAt(camera.position.x, camera.position.y, 0);
    camera.updateMatrixWorld();

    // Show the content panel once the camera has nearly arrived at the page's rung.
    const settled = Math.abs(prog - target) < .28 && focus.distanceTo(focusTarget) < .25;
    const want = target === 1 && settled && !swapping;
    if (want !== panelShow) {
      panelShow = want;
      applyState();
      if (want) requestAnimationFrame(scrollToHash);
    }

    composer.render();

    octx.clearRect(0, 0, W, H);
    const fade = clamp(1 - prog * 2.5, 0, 1);
    LABELED.forEach((j, i) => {
      const c = rungWorld[j];
      // On the circuit board the label's line starts at the rung's pin and is drawn as a trace ending in a ring.
      const onBoard = rungY[j] < Z_BOT;
      const startPt = toScreen(c.x + (Math.max(R, boardR(rungY[j])) + .35) / Math.cos(TILT_Z), c.y, c.z);
      const lx = startPt.x + (lay.phone ? 16 : 30);
      const on = i === hover;
      if (fade > 0) {
        octx.save();
        octx.globalAlpha = fade * (on ? .85 : onBoard ? .55 : .3);
        octx.strokeStyle = on ? '#7af0dd' : '#9fc6d6';
        octx.lineWidth = 1;
        octx.setLineDash(onBoard ? [] : [2, 5]);
        octx.beginPath(); octx.moveTo(startPt.x, startPt.y); octx.lineTo(onBoard ? lx - 13 : lx - 6, startPt.y); octx.stroke();
        if (onBoard) { octx.beginPath(); octx.arc(lx - 10, startPt.y, 3, 0, Math.PI * 2); octx.stroke(); }
        octx.restore();
      }
      links[i].style.transform = `translate(${lx}px, ${startPt.y - 17}px)`;
      links[i].classList.toggle('on', on);
    });

    if (!ready) {
      ready = true;
      window.__helixReady = true;
      applyState();
    }
  }

  resize();
  onPageLoad();
  loop();
}

start();
