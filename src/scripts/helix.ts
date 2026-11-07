// The particle helix behind every page. It survives page navigations (the #stage element is persisted by
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

  // SPIKE: the spinning helix ends at a collar on the rung just below "Selected work". Under it the strands carry on
  // as a flat circuit board that stays still and faces the viewer.
  const SEAM_RUNG = 13;
  const SEAM_Y = rungY[SEAM_RUNG], T_SEAM = (SEAM_RUNG + .5) / BP;

  // Particle shapes drawn by the fragment shader.
  const ROUND = 0, SQUARE = 1, RING = 2;
  type Cloud = { P: number[]; SIZE: number[]; BRIGHT: number[]; PHASE: number[]; RUNG: number[]; COL: number[]; SHAPE: number[]; FLOW: number[] };
  const newCloud = (): Cloud => ({ P: [], SIZE: [], BRIGHT: [], PHASE: [], RUNG: [], COL: [], SHAPE: [], FLOW: [] });
  let cloud = newCloud();
  const cA = new THREE.Color(0x27d6d0), cB = new THREE.Color(0x1ab0f0), cRung = new THREE.Color(0x7fe4f6), cHalo = new THREE.Color(0x1fa9d0);
  const cTrace = new THREE.Color(0x7cc4dc), cPad = new THREE.Color(0xb8ecf4), cFaint = new THREE.Color(0x4a9cbc);
  function add(x: number, y: number, z: number, size: number, bright: number, rung: number, col: THREE.Color, shape = ROUND, flow = -1) {
    cloud.P.push(x, y, z); cloud.SIZE.push(size); cloud.BRIGHT.push(bright); cloud.PHASE.push(Math.random()); cloud.RUNG.push(rung);
    cloud.SHAPE.push(shape); cloud.FLOW.push(flow);
    const j = 0.88 + Math.random() * 0.24;
    cloud.COL.push(col.r * j, col.g * j, col.b * j);
  }
  function geometryOf(c: Cloud) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(c.P, 3));
    g.setAttribute('aSize', new THREE.Float32BufferAttribute(c.SIZE, 1));
    g.setAttribute('aBright', new THREE.Float32BufferAttribute(c.BRIGHT, 1));
    g.setAttribute('aPhase', new THREE.Float32BufferAttribute(c.PHASE, 1));
    g.setAttribute('aRung', new THREE.Float32BufferAttribute(c.RUNG, 1));
    g.setAttribute('aColor', new THREE.Float32BufferAttribute(c.COL, 3));
    g.setAttribute('aShape', new THREE.Float32BufferAttribute(c.SHAPE, 1));
    g.setAttribute('aFlow', new THREE.Float32BufferAttribute(c.FLOW, 1));
    return g;
  }

  // Strands: a dense core plus a fuzzy outer layer, tidying up as they reach the collar.
  for (const [off, col] of [[0, cA], [GROOVE, cB]] as const) {
    const n = Math.round((LITE ? 1700 : 2800) * T_SEAM);
    for (let i = 0; i < n; i++) {
      const t = Math.random() * T_SEAM, [x, y, z] = strandPoint(t, off);
      const tidy = 1 - .75 * smooth(T_SEAM - .1, T_SEAM, t);
      const fuzzy = Math.random() < 0.3 * tidy, s = (fuzzy ? 0.17 : 0.065) * tidy;
      add(x + gauss() * s, y + gauss() * s * 0.6, z + gauss() * s, 0.5 + Math.random() * (fuzzy ? 0.7 : 1.1), fuzzy ? 0.35 + Math.random() * 0.35 : 0.55 + Math.random() * 0.45, -1, col);
    }
    // The strand's end: a contact that slides around the collar as the helix turns.
    const [x, y, z] = strandPoint(T_SEAM, off);
    add(x, y, z, 2.3, 1, -1, cPad, SQUARE);
  }

  // Rungs: thin dotted lines between the strands, down to the collar.
  const RUNG_DOTS = LITE ? 32 : 46;
  for (let j = 0; j < SEAM_RUNG; j++) {
    const t = (j + .5) / BP, a = strandPoint(t, 0), b = strandPoint(t, GROOVE);
    for (let k = 1; k < RUNG_DOTS; k++) {
      const f = k / RUNG_DOTS;
      add(a[0] + (b[0] - a[0]) * f + gauss() * .012, a[1] + gauss() * .012, a[2] + (b[2] - a[2]) * f + gauss() * .012, 0.55 + Math.random() * 0.4, 0.75 + Math.random() * 0.25, j, cRung);
    }
  }

  // The collar: a ring at the seam that both strand ends ride around.
  const COLLAR_DOTS = LITE ? 160 : 240;
  for (let k = 0; k < COLLAR_DOTS; k++) {
    const a = k / COLLAR_DOTS * Math.PI * 2;
    add(R * Math.cos(a), SEAM_Y, R * Math.sin(a), 0.6, 1, -1, cRung);
  }

  // Loose halo particles drifting around the strands.
  for (let i = 0; i < Math.round((LITE ? 450 : 800) * T_SEAM); i++) {
    const t = Math.random() * T_SEAM, [x, y, z] = strandPoint(t, Math.random() < .5 ? 0 : GROOVE);
    add(x + gauss() * .38, y + gauss() * .3, z + gauss() * .38, 0.4 + Math.random() * 0.6, 0.18 + Math.random() * 0.22, -1, cHalo);
  }
  const helixGeo = geometryOf(cloud);

  // ---------- Circuit board (SPIKE) ----------
  // Drawn flat at z = 0 in the helix's tilted frame and never spun. Traces are rows of fine dots; pads, chips and
  // terminals use the square and ring shapes. aFlow is the distance along a trace from the collar, which carries the
  // signal pulses down the board.
  cloud = newCloud();
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  type Pt = [number, number];
  // Fine spacing so traces still read as lines when the camera zooms in; dimmer dots keep the same overall glow.
  const STEP = LITE ? .02 : .012, DIM = STEP / .02;
  function trace(pts: Pt[], flow0 = -1, o: { bright?: number; rung?: number; col?: THREE.Color } = {}) {
    let flow = flow0;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      const d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(d / STEP));
      for (let k = i === 0 ? 0 : 1; k <= n; k++) {
        const f = k / n;
        add(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, 0, .42 + rnd() * .12, (o.bright ?? .4) * DIM, o.rung ?? -1, o.col ?? cTrace, ROUND, flow0 >= 0 ? flow + d * f : -1);
      }
      flow += d;
    }
    return flow;
  }
  const pad = (x: number, y: number, size = 1.8, flow = -1, rung = -1) => add(x, y, 0, size, 1, rung, cPad, SQUARE, flow);
  const ring = (x: number, y: number, size = 2.6, flow = -1) => add(x, y, 0, size, .95, -1, cPad, RING, flow);
  // Pads spaced along a path, like the squares on the card's strands.
  function padsAlong(pts: Pt[], flow0: number, every: number, size = 1.5) {
    let carry = every * .5, flow = flow0;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], d = Math.hypot(x1 - x0, y1 - y0);
      let s = carry;
      for (; s < d; s += every) pad(x0 + (x1 - x0) * s / d, y0 + (y1 - y0) * s / d, size, flow + s);
      carry = s - d;
      flow += d;
    }
  }
  // A bus line: dashes with small square pads, like the card's rungs below the crossing.
  function dashed(x0: number, x1: number, y: number) {
    let x = x0;
    while (x < x1 - .02) {
      if (rnd() < .3) { pad(x + .025, y, .9); x += .09; continue; }
      const len = .05 + rnd() * .11;
      trace([[x, y], [Math.min(x + len, x1), y]], -1, { bright: .45 });
      x += len + .045;
    }
  }
  const footprint = (cx: number, cy: number, cols: number, rows: number) => {
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) add(cx + (i - (cols - 1) / 2) * .055, cy + (j - (rows - 1) / 2) * .055, 0, .7, .55, -1, cFaint, SQUARE);
  };
  const bars = (cx: number, cy: number) => { for (let i = 0; i < 3; i++) trace([[cx - .07 + i * .02, cy + i * .045], [cx + .07, cy + i * .045]], -1, { bright: .3, col: cFaint }); };

  const CHIP_Y = -1.85, CHIP_H = .34, FAN_Y = -3.25, PIN_X = R + .35;
  const DIAG = R - CHIP_H;
  // Both strands cross inside the chip, so the board keeps the helix's X.
  let fanFlow = 0;
  for (const s of [-1, 1]) {
    const top: Pt[] = [[s * R, SEAM_Y], [s * R, CHIP_Y + CHIP_H + DIAG], [s * CHIP_H, CHIP_Y + CHIP_H]];
    const low: Pt[] = [[-s * CHIP_H, CHIP_Y - CHIP_H], [-s * R, CHIP_Y - CHIP_H - DIAG], [-s * R, FAN_Y]];
    pad(s * R, SEAM_Y, 2.1, 0);
    const e1 = trace(top, 0, { bright: .5 });
    padsAlong(top.slice(1), SEAM_Y - top[1][1], .27);
    const f2 = e1 + CHIP_H * 2 * Math.SQRT2;
    fanFlow = trace(low, f2, { bright: .5 });
    padsAlong(low.slice(0, 2), f2, .27);
  }

  // The chip: outline, pins, and the strands' X picked out in small squares inside.
  trace([[-CHIP_H, CHIP_Y + CHIP_H], [CHIP_H, CHIP_Y + CHIP_H], [CHIP_H, CHIP_Y - CHIP_H], [-CHIP_H, CHIP_Y - CHIP_H], [-CHIP_H, CHIP_Y + CHIP_H]], -1, { bright: .55, col: cPad });
  for (const o of [-.17, 0, .17]) {
    for (const s of [-1, 1]) {
      trace([[o, CHIP_Y + s * CHIP_H], [o, CHIP_Y + s * (CHIP_H + .08)]], -1, { bright: .4 });
      pad(o, CHIP_Y + s * (CHIP_H + .1), .8);
    }
  }
  for (const y of [CHIP_Y + .22, CHIP_Y + .08]) {
    for (const s of [-1, 1]) { trace([[s * CHIP_H, y], [s * (CHIP_H + .08), y]], -1, { bright: .4 }); pad(s * (CHIP_H + .1), y, .8); }
  }
  for (let i = -3; i <= 3; i++) {
    const o = i * CHIP_H * .24;
    pad(o, CHIP_Y + o, .75);
    if (i) pad(o, CHIP_Y - o, .75);
  }

  // Bus lines where rungs would be, between the strands.
  const strandX = (y: number) => { // where the board's strands are at height y (absolute x)
    if (y > CHIP_Y + CHIP_H + DIAG) return R;
    if (y > CHIP_Y + CHIP_H) return CHIP_H + (y - (CHIP_Y + CHIP_H));
    if (y > CHIP_Y - CHIP_H) return 0;
    return Math.min(R, CHIP_H + (CHIP_Y - CHIP_H - y));
  };
  for (const j of [14, 15, 19]) { const x = strandX(rungY[j]) - .07; dashed(-x, x, rungY[j]); }

  // The menu rungs on the board end in a pin on the right, where the label's trace starts.
  const BLOG_RUNG = 17, CONTACT_RUNG = 22;
  {
    const y = rungY[BLOG_RUNG], f0 = SEAM_Y - CHIP_Y + DIAG * .5;
    const e = trace([[CHIP_H, y], [PIN_X, y]], f0, { rung: BLOG_RUNG, bright: .5 });
    pad(PIN_X, y, 1.9, e, BLOG_RUNG);
    const e2 = trace([[-CHIP_H, y], [-(R + .25), y]], f0, { rung: BLOG_RUNG, bright: .5 });
    ring(-(R + .25) - .07, y, 2.6, e2);
  }
  {
    const y = rungY[CONTACT_RUNG];
    dashed(-.95, .9, y);
    const e = trace([[.9, y], [PIN_X, y]], fanFlow + .6, { rung: CONTACT_RUNG, bright: .5 });
    pad(PIN_X, y, 1.9, e, CONTACT_RUNG);
  }

  // Below the second crossing the strands fan out into traces that end in round terminals.
  for (const s of [-1, 1]) {
    const X = (x: number) => s * x, f0 = fanFlow;
    pad(X(R), FAN_Y, 2.1, f0);
    let e = trace([[X(R), FAN_Y], [X(R + .28), FAN_Y], [X(R + .45), FAN_Y - .17], [X(R + .45), -3.78]], f0);
    ring(X(R + .45), -3.78 - .07, 2.6, e);
    e = trace([[X(R), FAN_Y], [X(R), -3.52], [X(R + .15), -3.67], [X(R + .15), -4.4]], f0);
    ring(X(R + .15), -4.4 - .11, 4.2, e);
    trace([[X(R), FAN_Y], [X(.3), FAN_Y]], f0);
    for (const [x, jogY, jog, endY] of [[.84, -3.9, .1, -4.72], [.62, -4.3, 0, -4.88], [.4, -3.62, .1, -4.5]]) {
      e = trace([[X(x), FAN_Y], [X(x), jogY], [X(x - jog), jogY - jog], [X(x - jog), endY]], f0 + R - x);
      ring(X(x - jog), endY - .07, jog ? 2.4 : 3.4, e);
    }
  }
  footprint(0, -3.72, 3, 4);

  // Small parts scattered beside the traces, kept clear of the menu labels on the right.
  footprint(-1.78, -1.05, 2, 3); footprint(-1.95, -2.55, 3, 2); bars(-1.95, -3.25); footprint(-1.9, -4.45, 2, 3);
  bars(-1.55, -.75); footprint(1.72, -1.15, 2, 2); footprint(1.78, -2.95, 3, 2); bars(1.75, -4.6);
  const circuitGeo = geometryOf(cloud);

  const uniforms = {
    uTime: { value: 0 }, uPR: { value: PR }, uScale: { value: 110 }, uR: { value: R },
    uHL: { value: -1 }, uHLY: { value: 999 }, uPulse: { value: 1 },
  };
  // Both materials share these uniform objects, so updating one value updates both.
  const makeMat = (flat: number) => new THREE.ShaderMaterial({
    uniforms: { ...uniforms, uFlat: { value: flat } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float aSize; attribute float aBright; attribute float aPhase; attribute float aRung; attribute vec3 aColor;
      attribute float aShape; attribute float aFlow;
      uniform float uTime, uPR, uScale, uR, uHL, uHLY, uFlat, uPulse;
      varying float vAlpha; varying float vWhite; varying vec3 vColor; varying float vShape;
      void main(){
        vec3 p = position;
        float wob = 1.0 - uFlat;
        p.x += sin(uTime * .9 + aPhase * 6.283) * .012 * wob;
        p.z += cos(uTime * .7 + aPhase * 6.283) * .012 * wob;
        vec4 world = modelMatrix * vec4(p, 1.0);
        float front = mix((clamp(world.z / uR, -1.0, 1.0) + 1.0) * .5, .85, uFlat);
        float tw = mix(.78 + .22 * sin(uTime * 1.6 + aPhase * 40.0), .96, uFlat * .8);
        float hl = 0.0;
        if (uHL >= 0.0){
          if (aRung >= 0.0) hl = abs(aRung - uHL) < .5 ? 1.0 : 0.0;
          else { float dy = (position.y - uHLY) / .35; hl = exp(-dy * dy) * .7; }
        }
        float pulse = 0.0;
        if (aFlow >= 0.0) { float f = fract(aFlow / 2.6 - uTime * .2); f = min(f, 1.0 - f); pulse = exp(-f * f / .0005) * uPulse; }
        vAlpha = aBright * tw * mix(.2, 1.0, front) * (1.0 + hl * 1.6) * (1.0 + pulse * 3.0);
        vWhite = max(hl, pulse * .8);
        vColor = aColor;
        vShape = aShape;
        vec4 mv = viewMatrix * world;
        gl_PointSize = aSize * uPR * uScale * (1.0 + hl * mix(.7, .25, uFlat) + pulse * .5) * mix(.75, 1.15, front) / -mv.z;
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
          a = body * .9 + smoothstep(.5, .3, m) * .18; c = body * .35;
        } else {
          float d = length(q);
          if (d > .5) discard;
          float r = 1.0 - smoothstep(.035, .075, abs(d - .3));
          a = r * .95 + smoothstep(.5, .3, d) * .06; c = r * .3;
        }
        vec3 col = mix(vColor, vec3(1.0), c + vWhite * .6);
        gl_FragColor = vec4(col, a * vAlpha);
      }`,
  });

  // The helix spins around its own axis inside a tilted parent, so the lean stays fixed while it turns.
  // The circuit board sits in the same parent but does not spin.
  const TILT_Z = -0.21, TILT_X = 0.1;
  const tilt = new THREE.Group();
  tilt.rotation.set(TILT_X, 0, TILT_Z);
  scene.add(tilt);
  const helix = new THREE.Points(helixGeo, makeMat(0));
  const circuit = new THREE.Points(circuitGeo, makeMat(1));
  tilt.add(helix, circuit);
  tilt.updateMatrixWorld(true);
  const rungWorld = rungY.map(y => tilt.localToWorld(new THREE.Vector3(0, y, 0)));
  const pinWorld = rungY.map(y => tilt.localToWorld(new THREE.Vector3(PIN_X, y, 0)));
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
      helix.rotation.y += dt * (reduced ? SPEED_REDUCED : SPEED) * (target === 1 ? .35 : hover >= 0 ? .25 : 1);
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
      const onBoard = j > SEAM_RUNG;
      const startPt = onBoard ? toScreen(pinWorld[j].x, pinWorld[j].y, pinWorld[j].z) : toScreen(c.x + (R + .35) / Math.cos(TILT_Z), c.y, c.z);
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
