/* =============================================================================
   aiquor — hero3d.js
   Three.js hero + scroll-driven 3D scene.

   How it fits together:
   - A fixed, full-screen canvas sits behind the page (see the CSS block in
     index.html). It never takes pointer events and is aria-hidden.
   - Every section with a data-scene="N" attribute becomes one camera "shot".
     CONFIG.scenes holds one keyframe per shot. The script adapts to however
     many data-scene sections exist (extra sections reuse the last keyframes).
   - One GSAP timeline, scrubbed by ScrollTrigger, writes into `target` only.
     The render loop eases `current` toward `target` every frame, so scroll,
     mouse parallax and the idle float all blend with no jumps.
   - The laptop screen is a CanvasTexture that types out a code snippet per
     scene and finishes on "Let's build with Aiquor_".

   Tweak CONFIG first. Everything below it is plumbing.
   ========================================================================== */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

/* -----------------------------------------------------------------------------
   CONFIG
   -------------------------------------------------------------------------- */
const CONFIG = {
  colors: {
    background: '#F2F1EC',   // must match the page background (--color-stone)
    body:       '#1F4D3F',   // laptop shell
    keys:       '#16382D',
    trackpad:   '#24574A',
    accent:     '#E8973A',   // orange edge light + keyboard backlight
    glassTint:  '#F7F3EA',
    particle:   '#3E5049',   // most particles
    particleWarm: '#E8973A', // the warm few
    screenBg:   '#0B1612',
    code: {
      text:     '#DDE6E1',
      keyword:  '#E8973A',
      string:   '#9FD8B9',
      comment:  '#6C7C75',
      number:   '#F2C38B',
      fn:       '#CFE9DC',
      lineNo:   '#3A4B44',
    },
  },

  // Renderer / lighting
  exposure: 1.0,
  envIntensity: 0.65,        // how much RoomEnvironment shows up in reflections
  hemiIntensity: 0.55,
  keyIntensity: 1.6,
  screenLightIntensity: 2.2, // orange RectAreaLight spilling off the screen
  accentGlow: 0.9,           // emissive intensity of the orange edge strips
  backlightGlow: 0.16,       // emissive intensity of the keyboard backlight
  maxPixelRatio: 2,

  camera: {
    fov: 30,
    // Below this aspect ratio the fov widens so the laptop still fits (phones).
    minAspect: 1.3,
    maxFov: 58,
  },

  particles: {
    count: 1500,
    warmShare: 0.08,         // ~8% orange
    size: 11,                // base sprite size in px at distance 10
    maxSize: 34,             // px cap so near particles never turn into blobs
    opacityMin: 0.25,
    opacityMax: 0.45,
    focusDistance: 9,        // faux depth of field: sharpest at this camera distance
    focusRange: 6,
    drift: 0.35,             // noise drift amplitude (world units)
    driftSpeed: 0.12,
    bounds: { x: 11, yMin: -5, yMax: 8, zMin: -9, zMax: 5 },
  },

  glass: {
    count: 7,
    transmission: 1,
    ior: 1.4,
    iridescence: 0.3,
    // ACES tone mapping greys out the light page seen through the glass;
    // values above 1 lift it back to a clear, bright look.
    brightness: 1.45,
    // Each shape: type, size, base position, rotation speed, float amp/speed,
    // and scroll parallax (how far it slides per scene, bigger = closer feel).
    shapes: [
      { type: 'roundedCube', size: 0.62, pos: [ 2.35, 2.55, -1.5], rot: [0.12, 0.18, 0.05], amp: 0.16, speed: 0.55, parallax: 0.35, thickness: 1.1, roughness: 0.08 },
      { type: 'torus',       size: 0.44, pos: [-1.65, 2.55,  1.35], rot: [0.22, 0.10, 0.16], amp: 0.20, speed: 0.70, parallax: 0.85, thickness: 0.7, roughness: 0.06 },
      { type: 'icosa',       size: 0.42, pos: [ 2.45, 0.55,  1.55], rot: [0.10, 0.25, 0.08], amp: 0.14, speed: 0.62, parallax: 0.75, thickness: 0.9, roughness: 0.12 },
      { type: 'capsule',     size: 0.20, pos: [-0.55, 3.15, -1.85], rot: [0.06, 0.08, 0.20], amp: 0.12, speed: 0.48, parallax: 0.25, thickness: 0.8, roughness: 0.10 },
      { type: 'torus',       size: 0.24, pos: [ 1.20, 3.05,  1.20], rot: [0.30, 0.20, 0.10], amp: 0.18, speed: 0.80, parallax: 0.95, thickness: 0.6, roughness: 0.05 },
      { type: 'icosa',       size: 0.26, pos: [-2.05, 0.55, -1.00], rot: [0.14, 0.12, 0.18], amp: 0.10, speed: 0.58, parallax: 0.30, thickness: 0.7, roughness: 0.15 },
      { type: 'roundedCube', size: 0.34, pos: [ 3.25, 1.65,  0.15], rot: [0.16, 0.22, 0.12], amp: 0.15, speed: 0.66, parallax: 0.55, thickness: 0.8, roughness: 0.07 },
    ],
  },

  motion: {
    follow: 0.07,            // how fast current eases to the scroll target (0..1 per 60fps frame)
    mouseLerp: 0.05,         // mouse parallax smoothing
    mouseMaxDeg: 3,          // max parallax rotation
    floatAmp: 0.06,          // laptop bob height
    floatSpeed: 0.8,
    floatTilt: 0.012,        // tiny rotation while floating
    scrub: 1.2,              // ScrollTrigger scrub smoothing (seconds)
  },

  screen: {
    width: 1024,
    height: 640,
    fps: 24,                 // texture redraw cap
    typeCPS: 44,             // typing speed, characters per second
    linePause: 0.12,         // extra pause at each newline (s)
    blinkMs: 530,
    powerOnDelay: 0.35,      // s after first frame before the screen wakes
    powerOnDuration: 1.1,    // s of flicker + fade-up
    finaleHold: 0.6,         // s the last snippet stays before the finale line
    finaleText: "Let's build with Aiquor",
  },

  mobile: {
    // Applies below 768px wide or on coarse-pointer devices.
    particles: 400,
    glass: 3,
    maxPixelRatio: 1.5,
    glassOpacity: 0.32,      // MeshStandardMaterial fallback (no transmission)
  },

  // Layout: "wide" = desktop two-column hero (>= 900px), "stacked" otherwise.
  layout: {
    wideMinWidth: 900,
    stackedScale: 0.82,
  },

  /* ---------------------------------------------------------------------------
     Scenes, one per data-scene section, in order. The last one is the finale.
     computer: position / rotation (radians) / scale of the laptop
     camera:   position + lookAt
     frame:    where the shot sits on screen. x/y shift the whole picture as a
               fraction of the viewport (x 0.2 = 20% right of centre, y 0.2 =
               20% lower). opacity fades the canvas so text stays readable.
     glassDrift: multiplier for glass float amplitude/speed
     particleY:  vertical offset of the particle field
     code:       snippet typed on the screen when this section is entered
     ------------------------------------------------------------------------ */
  scenes: [
    {
      name: 'hero: 3/4 front',
      computer: { position: [0, 0, 0], rotation: [0, 0.24, 0], scale: 0.86 },
      camera:   { position: [5.2, 3.5, 8.6], lookAt: [0.25, 0.95, 0] },
      frame:    { wide: { x: 0.25, y: 0.04, opacity: 1 }, stacked: { x: 0.02, y: 0.22, opacity: 0.42 } },
      glassDrift: 1,
      particleY: 0,
      code: [
        '// aiquor.ts',
        'import { Intelligence } from "@aiquor/core";',
        '',
        'const aiquor = new Intelligence({ craft: true });',
        '',
        'aiquor.learn("how your team works");',
      ],
    },
    {
      name: 'services: low side angle',
      computer: { position: [0.3, 0, -0.2], rotation: [0, 0.95, 0], scale: 0.7 },
      camera:   { position: [7.6, 0.8, 3.2], lookAt: [0, 0.85, 0] },
      frame:    { wide: { x: 0.36, y: 0.06, opacity: 0.5 }, stacked: { x: 0.3, y: 0.16, opacity: 0.24 } },
      glassDrift: 1.5,
      particleY: 1.6,
      code: [
        '// agents that take the busywork',
        'const agent = aiquor.agent("triage", {',
        '  tools: [inbox, slack, crm],',
        '  human: "in the loop",',
        '});',
        '',
        'await agent.run();',
      ],
    },
    {
      name: 'about: top-down overview',
      computer: { position: [0, 0, 0], rotation: [0, -0.4, 0], scale: 0.62 },
      camera:   { position: [1.4, 10.5, 4.2], lookAt: [0, 0.2, 0] },
      frame:    { wide: { x: 0.37, y: 0.02, opacity: 0.5 }, stacked: { x: 0.3, y: 0.14, opacity: 0.24 } },
      glassDrift: 0.7,
      particleY: 3.4,
      code: [
        '// secure from day one',
        'mcp.server("inventory", {',
        '  auth: "scoped",',
        '  audit: true,',
        '  secrets: vault.ref("db"),',
        '});',
      ],
    },
    {
      name: 'finale: faces viewer, centred right',
      computer: { position: [0, 0, 0], rotation: [0, -0.04, 0], scale: 0.74 },
      camera:   { position: [0.9, 1.7, 8.4], lookAt: [0.1, 1.05, 0] },
      frame:    { wide: { x: 0.27, y: -0.15, opacity: 0.85 }, stacked: { x: 0.02, y: 0.12, opacity: 0.35 } },
      glassDrift: 0.9,
      particleY: 5,
      code: [
        'deploy({ docs: true, owner: "you" });',
      ],
      finale: true,
    },
  ],
};

/* -----------------------------------------------------------------------------
   Environment checks
   -------------------------------------------------------------------------- */
const root = document.documentElement;
const wrap = document.querySelector('.hero3d');
const canvas = document.getElementById('hero3d-canvas');

const mqReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const mqFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
const mqCoarse = window.matchMedia('(pointer: coarse)');

const isMobileTier = () => window.innerWidth < 768 || mqCoarse.matches;
const layoutMode = () => (window.innerWidth >= CONFIG.layout.wideMinWidth ? 'wide' : 'stacked');

function fail() {
  root.classList.remove('hero3d-on');
  root.classList.add('hero3d-fallback');
}

/* -----------------------------------------------------------------------------
   Small helpers
   -------------------------------------------------------------------------- */
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
// Frame-rate independent lerp factor: `k` is the factor at 60fps.
const damp = (k, dt) => 1 - Math.pow(1 - k, dt * 60);
const smoothstep = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

function debounce(fn, ms) {
  let id;
  return (...args) => { clearTimeout(id); id = setTimeout(() => fn(...args), ms); };
}

// Flatten a scene keyframe into the plain numbers GSAP tweens.
function flatKeyframe(scene, mode) {
  const c = scene.computer, cam = scene.camera, f = scene.frame[mode];
  return {
    cx: c.position[0], cy: c.position[1], cz: c.position[2],
    rx: c.rotation[0], ry: c.rotation[1], rz: c.rotation[2],
    s: c.scale,
    px: cam.position[0], py: cam.position[1], pz: cam.position[2],
    lx: cam.lookAt[0], ly: cam.lookAt[1], lz: cam.lookAt[2],
    fx: f.x, fy: f.y, op: f.opacity,
    glass: scene.glassDrift,
    particles: scene.particleY,
    progress: 0,
  };
}

// Map N sections onto the configured scenes. The last section always gets the
// finale; extra middle sections reuse the closest middle keyframe.
function scenesFor(count) {
  const list = CONFIG.scenes;
  if (count <= 1) return [list[0]];
  const out = [];
  for (let i = 0; i < count; i++) {
    if (i === count - 1) out.push(list[list.length - 1]);
    else out.push(list[Math.min(i, list.length - 2)]);
  }
  return out;
}

/* -----------------------------------------------------------------------------
   Textures generated on a canvas (no image requests)
   -------------------------------------------------------------------------- */
function radialTexture(size, stops) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => grad.addColorStop(o, col));
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* -----------------------------------------------------------------------------
   Screen: code typing on a CanvasTexture
   -------------------------------------------------------------------------- */
const KEYWORDS = /^(const|let|var|new|await|async|return|import|from|export|function|if|else|true|false|null)$/;

function tokenize(line) {
  const tokens = [];
  const re = /(\/\/.*$)|("(?:[^"\\]|\\.)*"?)|(\d+(?:\.\d+)?)|([A-Za-z_$][\w$]*)|(\s+)|([^\sA-Za-z_$\d"]+)/g;
  const col = CONFIG.colors.code;
  let m;
  while ((m = re.exec(line))) {
    const [text, comment, str, num, word] = m;
    let color = col.text;
    if (comment) color = col.comment;
    else if (str) color = col.string;
    else if (num) color = col.number;
    else if (word) {
      if (KEYWORDS.test(word)) color = col.keyword;
      else if (line[re.lastIndex] === '(') color = col.fn;
    }
    tokens.push({ text, color });
  }
  return tokens;
}

class CodeScreen {
  constructor() {
    const { width, height } = CONFIG.screen;
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;

    this.font = '500 30px ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace';
    this.bigFont = '600 54px ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace';
    this.ctx.font = this.font;
    this.charW = this.ctx.measureText('M').width;

    this.lines = [];
    this.schedule = [];
    this.total = 0;
    this.start = 0;
    this.mode = 'code';        // 'code' | 'finale'
    this.finalePending = false;
    this.lastDraw = -1;
    this.lastKey = '';
  }

  // Start typing a snippet at time `now` (seconds).
  setSnippet(lines, now, { finale = false, instant = false } = {}) {
    this.mode = 'code';
    this.lines = lines.map(tokenize);
    this.raw = lines;
    this.finalePending = finale;
    this.buildSchedule(lines.join('\n'));
    this.start = instant ? now - this.duration - 10 : now;
    this.lastKey = '';
  }

  setFinale(now, instant = false) {
    this.mode = 'finale';
    this.finalePending = false;
    this.buildSchedule(CONFIG.screen.finaleText);
    this.start = instant ? now - this.duration - 10 : now;
    this.lastKey = '';
  }

  buildSchedule(text) {
    const { typeCPS, linePause } = CONFIG.screen;
    this.schedule = [];
    let t = 0;
    for (const ch of text) {
      t += 1 / typeCPS + (ch === '\n' ? linePause : 0);
      this.schedule.push(t);
    }
    this.total = text.length;
    this.duration = t;
  }

  typedCount(now) {
    const e = now - this.start;
    if (e >= this.duration) return this.total;
    let lo = 0, hi = this.schedule.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (this.schedule[mid] <= e) lo = mid + 1; else hi = mid; }
    return lo;
  }

  // Returns true when the texture was redrawn.
  update(now, force = false) {
    if (this.finalePending && now - this.start > this.duration + CONFIG.screen.finaleHold) {
      this.setFinale(now);
    }
    if (!force && now - this.lastDraw < 1 / CONFIG.screen.fps) return false;

    const n = this.typedCount(now);
    const typing = n < this.total;
    const cursorOn = typing || Math.floor((now * 1000) / CONFIG.screen.blinkMs) % 2 === 0;
    const key = `${this.mode}|${n}|${cursorOn}`;
    if (!force && key === this.lastKey) return false;
    this.lastKey = key;
    this.lastDraw = now;

    if (this.mode === 'finale') this.drawFinale(n, cursorOn);
    else this.drawCode(n, cursorOn);
    this.texture.needsUpdate = true;
    return true;
  }

  drawChrome() {
    const { ctx } = this;
    const { width, height } = CONFIG.screen;
    const col = CONFIG.colors;
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, '#0E1C17');
    bg.addColorStop(1, col.screenBg);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Title bar
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    ctx.fillRect(0, 0, width, 46);
    [col.accent, '#4F6B60', '#33443E'].forEach((c, i) => {
      ctx.beginPath();
      ctx.arc(26 + i * 22, 23, 6.5, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.fill();
    });
    ctx.font = '500 21px ui-monospace, Menlo, Consolas, monospace';
    ctx.fillStyle = col.code.comment;
    ctx.textBaseline = 'middle';
    ctx.fillText('aiquor.ts', 104, 24);
  }

  drawCode(n, cursorOn) {
    const { ctx, charW } = this;
    const col = CONFIG.colors;
    this.drawChrome();

    const left = 84, top = 100, lineH = 46;
    ctx.font = this.font;
    ctx.textBaseline = 'middle';

    let remaining = n;
    let cx = left, cy = top;
    for (let li = 0; li < this.lines.length; li++) {
      const y = top + li * lineH;
      if (remaining < 0) break;
      // line number
      ctx.fillStyle = col.code.lineNo;
      ctx.textAlign = 'right';
      ctx.fillText(String(li + 1), 52, y);
      ctx.textAlign = 'left';

      let x = left;
      for (const tok of this.lines[li]) {
        if (remaining <= 0) break;
        const text = tok.text.slice(0, remaining);
        ctx.fillStyle = tok.color;
        ctx.fillText(text, x, y);
        x += text.length * charW;
        remaining -= text.length;
      }
      cx = x; cy = y;
      // consume the newline
      if (li < this.lines.length - 1) {
        if (remaining > 0) { remaining -= 1; cx = left; cy = top + (li + 1) * lineH; }
        else break;
      }
    }

    if (cursorOn) {
      ctx.fillStyle = col.accent;
      ctx.fillRect(cx + 2, cy - 17, charW * 0.62, 34);
    }
  }

  drawFinale(n, cursorOn) {
    const { ctx } = this;
    const { width, height, finaleText } = CONFIG.screen;
    const col = CONFIG.colors;
    this.drawChrome();

    ctx.font = this.bigFont;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const bigW = ctx.measureText('M').width;
    const x0 = Math.round((width - finaleText.length * bigW) / 2);
    const y = height / 2 + 14;

    // Faint prompt above the line
    ctx.font = '500 20px ui-monospace, Menlo, Consolas, monospace';
    ctx.fillStyle = col.code.comment;
    ctx.fillText('$ aiquor --start', x0, y - 70);

    ctx.font = this.bigFont;
    const brandAt = finaleText.lastIndexOf('Aiquor');
    const shown = finaleText.slice(0, n);
    const head = shown.slice(0, brandAt);
    const brand = shown.slice(brandAt);
    ctx.fillStyle = col.code.text;
    ctx.fillText(head, x0, y);
    if (brand && n > brandAt) {
      ctx.fillStyle = col.accent;
      ctx.fillText(brand, x0 + head.length * bigW, y);
    }
    if (cursorOn) {
      ctx.fillStyle = col.accent;
      ctx.fillRect(x0 + shown.length * bigW + 6, y + 20, bigW * 0.9, 7); // underscore cursor
    }
  }

  dispose() { this.texture.dispose(); }
}

/* -----------------------------------------------------------------------------
   Laptop, built from rounded boxes
   -------------------------------------------------------------------------- */
function buildLaptop(screen) {
  const C = CONFIG.colors;
  const rb = (w, h, d, r, seg = 4) => new RoundedBoxGeometry(w, h, d, seg, r);

  const bodyMat = new THREE.MeshStandardMaterial({ color: C.body, roughness: 0.55, metalness: 0.2 });
  const keyMat = new THREE.MeshStandardMaterial({ color: C.keys, roughness: 0.72, metalness: 0.08 });
  const padMat = new THREE.MeshStandardMaterial({ color: C.trackpad, roughness: 0.38, metalness: 0.2 });
  const accentMat = new THREE.MeshStandardMaterial({
    color: C.accent, emissive: C.accent, emissiveIntensity: CONFIG.accentGlow, roughness: 0.4,
  });
  const backlightMat = new THREE.MeshStandardMaterial({
    color: '#0F2A22', emissive: C.accent, emissiveIntensity: CONFIG.backlightGlow, roughness: 0.9,
  });

  const laptop = new THREE.Group();

  // Base
  const W = 3.2, D = 2.2, H = 0.12;
  const base = new THREE.Mesh(rb(W, H, D, 0.055), bodyMat);
  base.position.y = H / 2;
  laptop.add(base);

  // Keyboard backlight sits just under the keys; it shows through the gaps.
  const kbZ = -0.42;
  const backlight = new THREE.Mesh(rb(2.62, 0.008, 0.9, 0.003, 2), backlightMat);
  backlight.position.set(0, H + 0.002, kbZ);
  laptop.add(backlight);

  // Keys (instanced)
  const pitch = 0.205, keySize = 0.168, rows = 5, cols = 13;
  const keyGeo = rb(keySize, 0.03, keySize, 0.025, 2);
  const keys = new THREE.InstancedMesh(keyGeo, keyMat, rows * cols);
  const m = new THREE.Matrix4();
  let k = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Bottom row: leave the middle seven slots for the space bar.
      if (r === rows - 1 && c >= 3 && c <= 9) continue;
      m.setPosition((c - (cols - 1) / 2) * pitch, H + 0.02, kbZ + (r - (rows - 1) / 2) * 0.19);
      keys.setMatrixAt(k++, m);
    }
  }
  keys.count = k;
  laptop.add(keys);

  const space = new THREE.Mesh(rb(pitch * 7 - (pitch - keySize), 0.03, keySize, 0.025, 2), keyMat);
  space.position.set(0, H + 0.02, kbZ + 2 * 0.19);
  laptop.add(space);

  // Trackpad
  const pad = new THREE.Mesh(rb(1.15, 0.012, 0.6, 0.005, 2), padMat);
  pad.position.set(0, H + 0.002, 0.62);
  laptop.add(pad);

  // Orange edge strips along the base: front and both sides
  const front = new THREE.Mesh(rb(2.7, 0.014, 0.014, 0.006, 2), accentMat);
  front.position.set(0, H * 0.5, D / 2 + 0.001);
  laptop.add(front);
  [-1, 1].forEach((side) => {
    const s = new THREE.Mesh(rb(0.014, 0.014, 1.7, 0.006, 2), accentMat);
    s.position.set(side * (W / 2 + 0.001), H * 0.5, 0);
    laptop.add(s);
  });

  // Hinge
  const hinge = new THREE.Mesh(rb(2.5, 0.1, 0.1, 0.045, 3), bodyMat);
  hinge.position.set(0, H + 0.02, -D / 2 + 0.06);
  laptop.add(hinge);

  // Lid, pivoting at the back edge
  const lid = new THREE.Group();
  lid.position.set(0, H + 0.02, -D / 2 + 0.06);
  lid.rotation.x = -0.28;
  laptop.add(lid);

  const LH = 2.1, LD = 0.07;
  const shell = new THREE.Mesh(rb(W, LH, LD, 0.035), bodyMat);
  shell.position.set(0, LH / 2, 0);
  lid.add(shell);

  const screenMat = new THREE.MeshBasicMaterial({ map: screen.texture, toneMapped: false, color: 0x000000 });
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.875), screenMat);
  screenMesh.position.set(0, LH / 2 + 0.06, LD / 2 + 0.002);
  lid.add(screenMesh);

  // Soft additive halo: only over the dark screen, never over the light page.
  const haloTex = radialTexture(256, [[0, 'rgba(232,151,58,0.9)'], [0.55, 'rgba(232,151,58,0.25)'], [1, 'rgba(232,151,58,0)']]);
  const haloMat = new THREE.MeshBasicMaterial({
    map: haloTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
    depthWrite: false, toneMapped: false,
  });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 1.8), haloMat);
  halo.position.set(0, LH / 2 + 0.06, LD / 2 + 0.006);
  lid.add(halo);

  // Thin orange strip along the bottom bezel
  const bezel = new THREE.Mesh(rb(0.9, 0.014, 0.01, 0.004, 2), accentMat);
  bezel.position.set(0, 0.07, LD / 2 + 0.002);
  lid.add(bezel);

  // Orange light from the screen, spilling onto the keyboard and nearby glass.
  RectAreaLightUniformsLib.init();
  const screenLight = new THREE.RectAreaLight(CONFIG.colors.accent, 0, 2.8, 1.7);
  screenLight.position.set(0, LH / 2 + 0.06, 0.15);
  screenLight.rotation.y = Math.PI; // face out of the screen (+Z of the lid)
  lid.add(screenLight);

  return { laptop, screenMat, haloMat, screenLight, accentMat, backlightMat };
}

/* -----------------------------------------------------------------------------
   Glass shapes
   -------------------------------------------------------------------------- */
function glassGeometry(type, s) {
  switch (type) {
    case 'torus':       return new THREE.TorusGeometry(s, s * 0.38, 32, 96);
    case 'icosa':       return new THREE.IcosahedronGeometry(s, 0);
    case 'capsule':     return new THREE.CapsuleGeometry(s, s * 3, 12, 32);
    case 'roundedCube':
    default:            return new RoundedBoxGeometry(s, s, s, 6, s * 0.22);
  }
}

function buildGlass(mobile) {
  const group = new THREE.Group();
  const count = mobile ? CONFIG.mobile.glass : CONFIG.glass.count;
  const items = [];
  CONFIG.glass.shapes.slice(0, count).forEach((def, i) => {
    const mat = mobile
      ? new THREE.MeshStandardMaterial({
          color: CONFIG.colors.glassTint, roughness: 0.08, metalness: 0.1,
          transparent: true, opacity: CONFIG.mobile.glassOpacity, depthWrite: false,
        })
      : new THREE.MeshPhysicalMaterial({
          color: CONFIG.colors.glassTint,
          transmission: CONFIG.glass.transmission,
          thickness: def.thickness,
          roughness: def.roughness,
          ior: CONFIG.glass.ior,
          iridescence: CONFIG.glass.iridescence,
          iridescenceIOR: 1.3,
          metalness: 0,
          envMapIntensity: 1.1,
          specularIntensity: 1,
        });
    if (!mobile) mat.color.multiplyScalar(CONFIG.glass.brightness);
    const mesh = new THREE.Mesh(glassGeometry(def.type, def.size), mat);
    mesh.position.fromArray(def.pos);
    mesh.rotation.set(i * 0.7, i * 1.3, i * 0.4);
    group.add(mesh);
    items.push({ mesh, def, phase: i * 1.7 });
  });
  return { group, items };
}

/* -----------------------------------------------------------------------------
   Particles: soft dots, normal blending, faux depth of field in the shader
   -------------------------------------------------------------------------- */
function buildParticles(count) {
  const P = CONFIG.particles;
  const b = P.bounds;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const alpha = new Float32Array(count);
  const cool = new THREE.Color(CONFIG.colors.particle);
  const warm = new THREE.Color(CONFIG.colors.particleWarm);

  for (let i = 0; i < count; i++) {
    pos[i * 3]     = (Math.random() * 2 - 1) * b.x;
    pos[i * 3 + 1] = lerp(b.yMin, b.yMax, Math.random());
    pos[i * 3 + 2] = lerp(b.zMin, b.zMax, Math.random());
    const c = Math.random() < P.warmShare ? warm : cool;
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    seed[i] = Math.random();
    alpha[i] = lerp(P.opacityMin, P.opacityMax, Math.random());
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));

  const sprite = radialTexture(64, [[0, 'rgba(255,255,255,1)'], [0.45, 'rgba(255,255,255,0.75)'], [1, 'rgba(255,255,255,0)']]);

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    uniforms: {
      uTime:   { value: 0 },
      uOffset: { value: 0 },
      uSize:   { value: P.size },
      uMaxSize: { value: P.maxSize },
      uPixelRatio: { value: 1 },
      uFocus:  { value: P.focusDistance },
      uRange:  { value: P.focusRange },
      uDrift:  { value: P.drift },
      uSpeed:  { value: P.driftSpeed },
      uYMin:   { value: b.yMin },
      uYSpan:  { value: b.yMax - b.yMin },
      uMap:    { value: sprite },
    },
    vertexShader: /* glsl */`
      attribute vec3 color;
      attribute float seed;
      attribute float alpha;
      uniform float uTime, uOffset, uSize, uMaxSize, uPixelRatio, uFocus, uRange, uDrift, uSpeed, uYMin, uYSpan;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        // Cheap layered-sine "noise" drift, unique per particle
        float t = uTime * uSpeed;
        float s = seed * 6.2831;
        p.x += (sin(t * 1.3 + s) + 0.5 * sin(t * 2.1 + s * 2.7)) * uDrift;
        p.y += (cos(t * 1.1 + s * 1.7) + 0.5 * sin(t * 1.9 + s * 0.6)) * uDrift;
        p.z += sin(t * 0.9 + s * 3.1) * uDrift;
        // Scroll offset with wraparound so the field never runs out
        p.y = uYMin + mod(p.y - uYMin + uOffset, uYSpan);

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float dist = -mv.z;
        float blur = clamp(abs(dist - uFocus) / uRange, 0.0, 2.0);
        gl_PointSize = min(uSize * (1.0 + blur * 0.9) * (10.0 / max(dist, 0.5)), uMaxSize) * uPixelRatio;
        vAlpha = alpha / (1.0 + blur * 3.0);
        vColor = color;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D uMap;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float a = texture2D(uMap, gl_PointCoord).a * vAlpha;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vColor, a);
        #include <colorspace_fragment>
      }
    `,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return { points, mat };
}

/* -----------------------------------------------------------------------------
   Contact shadow: blurred radial gradient on a plane (no shadow maps)
   -------------------------------------------------------------------------- */
function buildShadow() {
  const tex = radialTexture(256, [[0, 'rgba(20,35,31,0.55)'], [0.45, 'rgba(20,35,31,0.22)'], [1, 'rgba(20,35,31,0)']]);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 3.8), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -0.02;
  mesh.renderOrder = -1;
  return { mesh, mat };
}

/* -----------------------------------------------------------------------------
   Main
   -------------------------------------------------------------------------- */
let app = null;

function init() {
  if (!wrap || !canvas) return;

  const reduced = mqReduced.matches;
  const mobile = isMobileTier();

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    fail();
    return;
  }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = CONFIG.exposure;
  // The canvas sits on the page background, so clear to that colour at full
  // alpha. Glass transmission samples this colour; a transparent clear makes
  // glass look grey on a light page.
  renderer.setClearColor(CONFIG.colors.background, 1);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomEnv = new RoomEnvironment();
  const envRT = pmrem.fromScene(roomEnv, 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = CONFIG.envIntensity;
  roomEnv.dispose();

  // Soft studio lighting
  scene.add(new THREE.HemisphereLight('#ffffff', '#cfc8b8', CONFIG.hemiIntensity));
  const key = new THREE.DirectionalLight('#fff3e3', CONFIG.keyIntensity);
  key.position.set(-4, 7, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#e6efe9', 0.5);
  rim.position.set(5, 3, -6);
  scene.add(rim);

  const camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, 1, 0.1, 80);

  // Scene graph: rig (scroll transform) > floater (bob) > laptop
  const rig = new THREE.Group();
  const floater = new THREE.Group();
  rig.add(floater);
  scene.add(rig);

  const screen = new CodeScreen();
  const lap = buildLaptop(screen);
  floater.add(lap.laptop);

  const shadow = buildShadow();
  rig.add(shadow.mesh);

  const glass = buildGlass(mobile);
  scene.add(glass.group);

  const particles = buildParticles(mobile ? CONFIG.mobile.particles : CONFIG.particles.count);
  scene.add(particles.points);

  // Sections
  const sections = Array.from(document.querySelectorAll('[data-scene]'))
    .sort((a, b) => Number(a.dataset.scene) - Number(b.dataset.scene));
  const shots = scenesFor(Math.max(1, sections.length));

  // State: target is written by GSAP, current eases toward it.
  let mode = layoutMode();
  const target = flatKeyframe(shots[0], mode);
  const current = { ...target };
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };

  const state = {
    renderer, scene, camera, pmrem, envRT, screen, rig, floater, lap, shadow, glass, particles,
    sections, shots, target, current, mouse,
    reduced, mobile, mode,
    timeline: null, triggers: [], observers: [], listeners: [],
    running: false, inView: true, firstFrame: false,
    clock: new THREE.Clock(), elapsed: 0,
    activeScene: 0, poweredAt: -1, powerStart: null, // powerStart: null until the screen wakes
  };
  app = state;

  const on = (el, type, fn, opts) => { el.addEventListener(type, fn, opts); state.listeners.push([el, type, fn, opts]); };

  /* ----- sizing & composition ----- */
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const maxPR = state.mobile ? CONFIG.mobile.maxPixelRatio : CONFIG.maxPixelRatio;
    const pr = Math.min(window.devicePixelRatio || 1, maxPR);
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    particles.mat.uniforms.uPixelRatio.value = pr;

    const aspect = w / h;
    camera.aspect = aspect;
    // Narrow screens: widen the vertical fov so the horizontal view never
    // drops below what minAspect would show.
    if (aspect < CONFIG.camera.minAspect) {
      const t = Math.tan(THREE.MathUtils.degToRad(CONFIG.camera.fov / 2)) * (CONFIG.camera.minAspect / aspect);
      camera.fov = Math.min(CONFIG.camera.maxFov, THREE.MathUtils.radToDeg(Math.atan(t)) * 2);
    } else {
      camera.fov = CONFIG.camera.fov;
    }
    camera.updateProjectionMatrix();

    const newMode = layoutMode();
    if (newMode !== state.mode) {
      state.mode = newMode;
    }
    buildTimeline();
    if (!state.running) renderOnce();
  }

  // Shift the whole picture on screen without moving the camera.
  function applyFrame(fx, fy) {
    const w = window.innerWidth, h = window.innerHeight;
    camera.setViewOffset(w, h, -fx * w, -fy * h, w, h);
  }

  /* ----- scroll choreography ----- */
  function sceneAnchors() {
    const vh = window.innerHeight;
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - vh);
    const anchors = [];
    sections.forEach((el, i) => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      let a = i === 0 ? 0 : Math.min(maxScroll, Math.max(0, top - vh * 0.3));
      if (i > 0 && a <= anchors[i - 1]) a = anchors[i - 1] + 1;
      anchors.push(a);
    });
    return anchors;
  }

  function buildTimeline() {
    const gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
    if (gsap && ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
    const keys = shots.map((s) => flatKeyframe(s, state.mode));

    if (state.timeline) {
      state.timeline.scrollTrigger && state.timeline.scrollTrigger.kill();
      state.timeline.kill();
      state.timeline = null;
    }

    // Without GSAP (or reduced motion, or only one section): hold scene 1.
    if (state.reduced || !gsap || !ScrollTrigger || sections.length < 2) {
      Object.assign(target, keys[0]);
      if (state.reduced) Object.assign(current, keys[0]);
      return;
    }

    const anchors = sceneAnchors();
    const tl = gsap.timeline({
      defaults: { ease: 'power2.inOut' },
      scrollTrigger: {
        start: anchors[0],
        end: anchors[anchors.length - 1],
        scrub: CONFIG.motion.scrub,
      },
    });
    for (let i = 0; i < keys.length - 1; i++) {
      const from = { ...keys[i], progress: i / (keys.length - 1) };
      const to = { ...keys[i + 1], progress: (i + 1) / (keys.length - 1) };
      tl.fromTo(target, from, { ...to, duration: anchors[i + 1] - anchors[i], immediateRender: false }, anchors[i] - anchors[0]);
    }
    state.timeline = tl;
    tl.scrollTrigger.refresh();
    // Snap target to the current scroll position so a resize mid-page does not drift.
    tl.progress(tl.scrollTrigger.progress);
  }

  /* ----- which section is "active" for the screen ----- */
  function setActiveScene(i) {
    i = Math.max(0, Math.min(shots.length - 1, i));
    if (i === state.activeScene && state.screenStarted) return;
    state.activeScene = i;
    if (state.poweredAt < 0) return; // typing starts after power-on
    const shot = shots[i];
    state.screenStarted = true;
    screen.setSnippet(shot.code, state.elapsed, { finale: !!shot.finale });
  }

  function sceneFromScroll() {
    const line = window.innerHeight * 0.55;
    let idx = 0;
    sections.forEach((el, i) => { if (el.getBoundingClientRect().top <= line) idx = i; });
    return idx;
  }

  function watchSections() {
    let ticking = false;
    const check = () => { ticking = false; setActiveScene(sceneFromScroll()); };
    on(window, 'scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(check); } }, { passive: true });

    // Pause when no animated section is on screen (e.g. the opaque contact block).
    if ('IntersectionObserver' in window) {
      const visible = new Set();
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target)));
        state.inView = visible.size > 0;
        updateRunning();
      }, { rootMargin: '10% 0px 10% 0px' });
      sections.forEach((el) => io.observe(el));
      state.observers.push(io);
    }
  }

  /* ----- input ----- */
  function watchMouse() {
    if (state.reduced || !mqFinePointer.matches) return;
    on(window, 'pointermove', (e) => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
    on(document, 'mouseleave', () => { mouse.x = 0; mouse.y = 0; });
  }

  /* ----- per-frame update ----- */
  const tmpLook = new THREE.Vector3();
  const tmpPos = new THREE.Vector3();
  const tmpOff = new THREE.Vector3();
  const spherical = new THREE.Spherical();
  let lastOpacity = -1;

  function powerLevel(t) {
    // 0 → flicker (orange) → full white. Returns { b: brightness, warm: 0..1, halo }
    const S = CONFIG.screen;
    if (state.powerStart === null) return { b: 0, warm: 1, halo: 0 };
    const e = t - state.powerStart;
    if (e >= S.powerOnDuration) return { b: 1, warm: 0, halo: 0.07 };
    const p = e / S.powerOnDuration;
    // Two soft flickers in the first ~40%, then a smooth fade-up.
    const flicker = p < 0.4 ? (0.35 + 0.65 * Math.abs(Math.sin(p * 38))) * smoothstep(0, 0.08, p) : 1;
    const b = flicker * smoothstep(0.0, 0.9, p) * (p < 0.4 ? 0.55 : 1);
    return { b, warm: 1 - smoothstep(0.35, 1, p), halo: 0.07 + 0.22 * (1 - smoothstep(0.3, 1, p)) * flicker };
  }

  const warmColor = new THREE.Color(CONFIG.colors.accent);
  const white = new THREE.Color(1, 1, 1);

  function update(dt, t) {
    const M = CONFIG.motion;
    const still = state.reduced;

    // Ease current → target (reduced motion: snap)
    const k = still ? 1 : damp(M.follow, dt);
    for (const key in target) current[key] = lerp(current[key], target[key], k);

    // Mouse parallax, smoothed
    const km = damp(M.mouseLerp, dt);
    mouse.sx = lerp(mouse.sx, mouse.x, km);
    mouse.sy = lerp(mouse.sy, mouse.y, km);
    const maxRad = THREE.MathUtils.degToRad(M.mouseMaxDeg);

    // Composition
    const stackedScale = state.mode === 'stacked' ? CONFIG.layout.stackedScale : 1;
    applyFrame(current.fx, current.fy);

    // Rig: scroll position/rotation/scale + a touch of mouse rotation
    rig.position.set(current.cx, current.cy, current.cz);
    rig.rotation.set(current.rx - mouse.sy * maxRad * 0.4, current.ry + mouse.sx * maxRad * 0.6, current.rz);
    rig.scale.setScalar(current.s * stackedScale);

    // Idle float
    if (!still) {
      floater.position.y = Math.sin(t * M.floatSpeed) * M.floatAmp + M.floatAmp;
      floater.rotation.z = Math.sin(t * M.floatSpeed * 0.75) * M.floatTilt;
      floater.rotation.x = Math.sin(t * M.floatSpeed * 0.6 + 1) * M.floatTilt * 0.8;
    } else {
      floater.position.y = M.floatAmp;
    }
    const lift = floater.position.y / (M.floatAmp * 2 || 1);
    shadow.mat.opacity = 0.95 - lift * 0.3;
    shadow.mesh.scale.setScalar(1 + lift * 0.08);

    // Camera: keyframe position, orbited a few degrees by the mouse
    tmpLook.set(current.lx, current.ly, current.lz);
    tmpOff.set(current.px, current.py, current.pz).sub(tmpLook);
    spherical.setFromVector3(tmpOff);
    spherical.theta += mouse.sx * maxRad;
    spherical.phi = Math.min(Math.PI - 0.01, Math.max(0.01, spherical.phi + mouse.sy * maxRad * 0.6));
    tmpPos.setFromSpherical(spherical).add(tmpLook);
    camera.position.copy(tmpPos);
    camera.lookAt(tmpLook);

    // Glass: each shape rotates and floats at its own speed; scroll slides
    // them by their parallax factor so near shapes move more than far ones.
    const drift = current.glass;
    const scrollP = current.progress;
    for (const g of glass.items) {
      const d = g.def;
      if (!still) {
        g.mesh.rotation.x += d.rot[0] * dt * drift;
        g.mesh.rotation.y += d.rot[1] * dt * drift;
        g.mesh.rotation.z += d.rot[2] * dt * drift;
      }
      const f = still ? 0 : Math.sin(t * d.speed * Math.max(0.4, drift) + g.phase) * d.amp * drift;
      g.mesh.position.set(
        d.pos[0] + (still ? 0 : Math.cos(t * d.speed * 0.6 + g.phase) * d.amp * 0.4),
        d.pos[1] + f - scrollP * d.parallax * 2.2,
        d.pos[2]
      );
    }

    // Particles
    const pu = particles.mat.uniforms;
    pu.uTime.value = still ? 0 : t;
    pu.uOffset.value = current.particles;

    // Screen power-on + typing
    const pw = powerLevel(t);
    lap.screenMat.color.copy(white).lerp(warmColor, pw.warm * 0.55).multiplyScalar(pw.b);
    lap.haloMat.opacity = pw.halo;
    lap.screenLight.intensity = CONFIG.screenLightIntensity * pw.b;
    if (state.powerStart !== null && state.poweredAt < 0 && t - state.powerStart >= CONFIG.screen.powerOnDuration * 0.75) {
      state.poweredAt = t;
      setActiveScene(sceneFromScroll());
    }
    screen.update(t);

    // Canvas opacity per scene (cheap CSS, only written when it changes)
    const op = Math.round(current.op * 1000) / 1000;
    if (op !== lastOpacity) { canvas.style.opacity = String(op); lastOpacity = op; }
  }

  function render() {
    renderer.render(scene, camera);
    if (!state.firstFrame) {
      state.firstFrame = true;
      root.classList.add('hero3d-ready');
      root.classList.remove('hero3d-fallback');
    }
  }

  function frame() {
    const dt = Math.min(state.clock.getDelta(), 1 / 20);
    state.elapsed += dt;
    if (state.powerStart === null && state.elapsed > CONFIG.screen.powerOnDelay) state.powerStart = state.elapsed;
    update(dt, state.elapsed);
    render();
  }

  function renderOnce() {
    if (state.reduced) {
      // One composed still: screen fully on, code fully typed.
      state.powerStart = -100; state.poweredAt = 0; state.screenStarted = true;
      const shot = shots[0];
      screen.setSnippet(shot.code, state.elapsed, { instant: true });
      update(0, state.elapsed);
      screen.update(state.elapsed, true);
    } else {
      update(0, state.elapsed);
    }
    render();
  }

  function updateRunning() {
    const shouldRun = !state.reduced && state.inView && document.visibilityState === 'visible' && !state.disposed;
    if (shouldRun === state.running) return;
    state.running = shouldRun;
    if (shouldRun) { state.clock.getDelta(); renderer.setAnimationLoop(frame); }
    else renderer.setAnimationLoop(null);
  }

  /* ----- wire up ----- */
  root.classList.add('hero3d-on');
  if (state.mobile) root.classList.add('hero3d-lite');

  resize();
  watchSections();
  watchMouse();

  on(window, 'resize', debounce(resize, 150));
  on(document, 'visibilitychange', updateRunning);
  // Late layout shifts (web fonts, images) move section offsets.
  if (document.readyState !== 'complete') on(window, 'load', () => buildTimeline());
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => !state.disposed && buildTimeline());

  // First frame lands immediately; the loop starts unless motion is reduced.
  renderOnce();
  updateRunning();
}

/* -----------------------------------------------------------------------------
   Teardown (pagehide) and restore (back/forward cache)
   -------------------------------------------------------------------------- */
function destroy() {
  if (!app) return;
  const s = app;
  s.disposed = true;
  s.renderer.setAnimationLoop(null);
  s.listeners.forEach(([el, type, fn, opts]) => el.removeEventListener(type, fn, opts));
  s.observers.forEach((o) => o.disconnect());
  if (s.timeline) { s.timeline.scrollTrigger && s.timeline.scrollTrigger.kill(); s.timeline.kill(); }

  const seen = new Set();
  s.scene.traverse((obj) => {
    if (obj.geometry && !seen.has(obj.geometry)) { seen.add(obj.geometry); obj.geometry.dispose(); }
    const mats = obj.material ? (Array.isArray(obj.material) ? obj.material : [obj.material]) : [];
    mats.forEach((m) => {
      if (seen.has(m)) return;
      seen.add(m);
      for (const key in m) {
        const v = m[key];
        if (v && v.isTexture && !seen.has(v)) { seen.add(v); v.dispose(); }
      }
      if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u.value && u.value.isTexture) u.value.dispose();
      m.dispose();
    });
  });
  s.screen.dispose();
  s.envRT.dispose();
  s.pmrem.dispose();
  s.renderer.dispose();
  root.classList.remove('hero3d-ready');
  app = null;
}

window.addEventListener('pagehide', destroy);
window.addEventListener('pageshow', (e) => { if (e.persisted && !app) init(); });

init();
