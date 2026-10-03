/* =============================================================================
   aiquor — hero3d.js
   Laptop + phone booking story, scrubbed by scroll.

   How it fits together
   - A fixed, transparent canvas sits behind the page (CSS block 12 in
     index.html). It never takes pointer events and is aria-hidden.
   - Each section with data-scene="1".."5" is one step of the story. The script
     measures those sections, so it follows the real layout and heights.
   - One GSAP timeline, scrubbed by ScrollTrigger, writes into `target` only.
     The render loop eases `current` toward `target` every frame, so scroll,
     idle float and mouse parallax blend with no jumps, and scrolling up
     rewinds everything.
   - Both screens are CanvasTextures drawn from one value, `story` (0 → 4,
     one unit per step). Typing, pulses, agent states and the booking all
     read from it, so they rewind too.

   Performance choices (keep these if you extend it)
   - MeshStandardMaterial only. No transmission, no shadow maps, no post FX.
   - Keys are one InstancedMesh (one draw call); mobile uses a textured plane.
   - Screens redraw only when the story moves or a small live detail ticks,
     capped at 30fps (24 on mobile). Canvas shadows are faked with layered
     fills because ctx.shadowBlur is slow.
   - Render resolution is capped by pixel count and drops automatically if
     frames get slow. Rendering stops when the tab is hidden or no story
     section is on screen.

   Edit CONFIG first. Everything below it is plumbing.
   ========================================================================== */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* -----------------------------------------------------------------------------
   CONFIG
   -------------------------------------------------------------------------- */
const CONFIG = {
  colors: {
    background: '#12261F',   // used for fog; the page background shows through the canvas
    device:     '#2A6553',   // laptop + phone bodies
    deviceDeep: '#1F4D3F',   // keys, hinge, camera island
    trackpad:   '#327561',
    accent:     '#E8973A',
    keyLight:   '#FFE6C7',
    fillLight:  '#9FC4B5',
    rimLight:   '#F5F1E8',
  },

  // Screen UI (both CanvasTextures)
  ui: {
    font:       'Figtree, "Helvetica Neue", Arial, sans-serif',
    bg:         '#F5F1E8',
    surface:    '#FFFFFF',
    surfaceAlt: '#EDE6D8',
    text:       '#1F4D3F',
    muted:      '#71837B',
    line:       'rgba(31,77,63,0.12)',
    accent:     '#E8973A',
    success:    '#2F8A5F',
    idle:       '#B7C1BB',
    online:     '#3BB273',
  },

  // Phone: the client's chat with the Aiquor Assistant
  chat: {
    appName:       'Aiquor Assistant',
    status:        'Online · replies instantly',
    greeting:      'Hi! How can I help you today?',
    clientMessage: "Hi, I'd like a call about automating my customer support",
    reply:         'Great! Here are a few times for a quick call:',
    slots:         ['Wed, 11:00 AM', 'Thu, 3:00 PM', 'Fri, 9:30 AM'],
    pick:          1,                          // index into slots
    pickedMessage: 'Thu, 3:00 PM works for me',
    bookedTitle:   'Call booked ✓',
    bookedDetail:  'Thu, 3:00 PM · 30 min',
    bookedNote:    'Invite sent to your email',
    notifyTitle:   'Aiquor Assistant',
    notifyBody:    'Call booked for Thu, 3:00 PM',
    placeholder:   'Message',
  },

  // Laptop: the Aiquor Agents dashboard
  dashboard: {
    title:     'Aiquor Agents',
    subtitle:  'Your AI team, working in real time',
    online:    '3 agents online',
    agents: [
      { name: 'Receptionist Agent', role: 'Reads every request',     initial: 'R' },
      { name: 'Scheduler Agent',    role: 'Finds a time that works', initial: 'S' },
      { name: 'Follow-up Agent',    role: 'Confirms and reminds',    initial: 'F' },
    ],
    calendarTitle: 'Availability · this week',
    calendarIdle:  'Waiting for a request…',
    days:  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    times: ['9:30', '11:00', '1:00', '3:00'],
    // [dayIndex, timeIndex] of the open slots, in the same order as chat.slots
    openSlots: [[2, 1], [3, 3], [4, 0]],
    summary:   'Booked in 42s by Aiquor agents',
    logTitle:  'Live activity',
    logIdle:   'Waiting for activity…',
  },

  // Activity log lines. `at` is in story units (0 = step 1 … 4 = step 5).
  log: [
    { at: 0.86, text: 'New message from client…' },
    { at: 0.92, text: 'Understanding request…' },
    { at: 0.98, text: 'Intent: book a call' },
    { at: 1.28, text: 'Handoff → Scheduler Agent' },
    { at: 1.50, text: 'Checking calendar…' },
    { at: 1.92, text: '3 open slots found' },
    { at: 2.24, text: 'Sent 3 time options' },
    { at: 2.96, text: 'Client picked Thu, 3:00 PM' },
    { at: 3.20, text: 'Call booked · Thu, 3:00 PM' },
    { at: 3.62, text: 'Confirmation sent ✓' },
  ],

  // Story timing, in story units. Step N is reached at story = N - 1.
  // Each pair is [start, end] of an eased transition.
  story: {
    typing:           [0.06, 0.50],  // client types on the phone
    send:             [0.52, 0.64],  // message leaves the input and lands in the chat
    receptionist:     [0.84, 0.96],  // Receptionist turns orange
    handoff:          [1.04, 1.36],  // connector draws Receptionist → Scheduler
    receptionistDone: [1.30, 1.42],
    scheduler:        [1.34, 1.48],
    calendarIn:       [1.28, 1.46],
    scan:             [1.46, 1.94],  // calendar slots light up one by one
    dotsIn:           [1.10, 1.22],  // phone typing dots
    dotsOut:          [2.18, 2.26],
    reply:            [2.22, 2.38],
    chips:            [2.30, 2.56],  // three time chips, staggered inside this window
    tap:              [2.58, 2.80],  // tap ripple on the picked chip
    picked:           [2.76, 2.90],
    schedulerDone:    [3.04, 3.18],
    followUp:         [3.14, 3.28],
    booked:           [3.28, 3.48],  // "Call booked ✓" card on the phone
    notification:     [3.52, 3.74],  // banner slides down on the phone
    followUpDone:     [3.58, 3.74],
    summary:          [3.74, 3.94],  // "Booked in 42s" on the laptop
  },

  // Orange light pulses along the curve between devices
  pulses: [
    { window: [0.64, 0.90], to: 'laptop' },
    { window: [2.00, 2.24], to: 'phone' },
    { window: [2.84, 3.04], to: 'laptop' },
  ],

  intro: {
    lidDuration:   1.6,   // s, lid opens closed → ~105° (power3.out)
    phoneDelay:    0.25,
    phoneDuration: 1.4,
    screensOnAt:   0.9,   // s, screens fade on
    screensOnFor:  0.9,
    lidOpenAngle:  -0.26, // radians past vertical (≈105° open)
  },

  motion: {
    follow:      0.075,   // current → target easing per 60fps frame (lower = silkier, slower)
    storyFollow: 0.12,
    scrub:       1.2,     // ScrollTrigger scrub smoothing, seconds
    ease:        'sine.inOut',
    mouseLerp:   0.05,
    mouseMaxDeg: 3,
    laptopFloat: { amp: 0.03, speed: 0.62, tilt: 0.006 },
    phoneFloat:  { amp: 0.05, speed: 0.95, tilt: 0.014 },
  },

  render: {
    exposure: 1.1,
    envIntensity: 0.45,
    fov: 30,
    minAspect: 1.25,        // narrower screens widen the fov so devices still fit
    maxFov: 56,
    maxPixelRatio: 2,
    maxPixels: 4.2e6,       // cap on drawing-buffer pixels (keeps 4K/retina smooth)
    minPixelRatio: 1,
    slowFrameMs: 22,        // if average frame time is above this, resolution drops a step
    screenFps: 30,
    fogNear: 11,
    fogFar: 24,
  },

  mobile: {
    // < 768px wide or coarse pointer
    maxPixelRatio: 1.5,
    maxPixels: 1.8e6,
    minPixelRatio: 0.75,
    screenFps: 24,
    phoneCanvas:  [420, 840],
    laptopCanvas: [960, 600],
  },

  desktopCanvas: { phone: [600, 1200], laptop: [1280, 800] },

  layout: {
    wideMinWidth: 1024,   // matches the story-column CSS breakpoint
    // When each step lands. Wide: as the section's top reaches 35% of the
    // viewport. Stacked: as the section's bottom reaches 85%, so the step
    // plays in the clear gap after the section's text.
    wideAnchor: 0.35,
    stackedAnchor: 0.85,
  },

  /* ---------------------------------------------------------------------------
     Camera keyframes, one per step (data-scene 1..5).
     camera:  position + lookAt (world units)
     laptop / phone: position + rotation (radians)
     frame:   shifts the whole picture on screen without moving the camera.
              x 0.22 = picture centre 22% right of the viewport centre,
              y 0.2  = 20% lower. "wide" = desktop story column, "stacked" =
              tablet/phone where text runs full width.
     stackedZoom: camera distance multiplier on stacked layouts (< 1 = closer)
     ------------------------------------------------------------------------ */
  steps: [
    {
      name: '1 · wide 3/4, both devices',
      camera: { position: [3.6, 3.1, 10.4], lookAt: [0.45, 0.85, 0] },
      laptop: { position: [0.9, 0, -0.25], rotation: [0, -0.2, 0] },
      phone:  { position: [-1.3, 0.95, 1.05], rotation: [-0.08, 0.5, 0.02] },
      frame:  { wide: { x: 0.25, y: 0.02 }, stacked: { x: 0, y: 0.25 } },
      stackedZoom: 1,
    },
    {
      name: '2 · glide to the phone (client types)',
      camera: { position: [-0.45, 1.25, 5.0], lookAt: [-1.2, 0.98, 1.05] },
      laptop: { position: [0.9, 0, -0.25], rotation: [0, -0.2, 0] },
      phone:  { position: [-1.3, 0.98, 1.05], rotation: [-0.04, 0.16, 0] },
      frame:  { wide: { x: 0.24, y: 0.0 }, stacked: { x: 0, y: 0.02 } },
      stackedZoom: 0.78,
    },
    {
      name: '3 · swing to the laptop dashboard',
      camera: { position: [1.3, 2.0, 6.1], lookAt: [1.0, 0.98, -1.3] },
      laptop: { position: [0.9, 0, -0.25], rotation: [0, -0.04, 0] },
      phone:  { position: [-4.6, 0.9, -1.4], rotation: [-0.06, 0.7, 0.02] },
      frame:  { wide: { x: 0.31, y: 0.0 }, stacked: { x: 0, y: 0.02 } },
      stackedZoom: 0.94,
    },
    {
      name: '4 · back to the phone (slot picked)',
      camera: { position: [-2.15, 1.45, 4.75], lookAt: [-1.15, 0.98, 1.0] },
      laptop: { position: [0.9, 0, -0.25], rotation: [0, -0.12, 0] },
      phone:  { position: [-1.3, 0.98, 1.05], rotation: [-0.04, -0.24, 0] },
      frame:  { wide: { x: 0.24, y: 0.0 }, stacked: { x: 0, y: 0.02 } },
      stackedZoom: 0.78,
    },
    {
      name: '5 · pull back, side by side',
      camera: { position: [0.4, 1.75, 10.6], lookAt: [0.35, 0.88, 0] },
      laptop: { position: [0.8, 0, -0.3], rotation: [0, 0, 0] },
      phone:  { position: [-1.3, 0.95, 0.5], rotation: [-0.04, 0.05, 0] },
      frame:  { wide: { x: 0.27, y: 0.0 }, stacked: { x: 0, y: 0.02 } },
      stackedZoom: 1,
    },
  ],
};

/* -----------------------------------------------------------------------------
   Environment
   -------------------------------------------------------------------------- */
const root = document.documentElement;
const wrap = document.querySelector('.hero3d');
const canvas = document.getElementById('hero3d-canvas');
const STORY_MAX = 4;

const mqReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const mqFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
const mqCoarse = window.matchMedia('(pointer: coarse)');
const isMobileTier = () => window.innerWidth < 768 || mqCoarse.matches;
const layoutMode = () => (window.innerWidth >= CONFIG.layout.wideMinWidth ? 'wide' : 'stacked');

function fail() {
  root.classList.remove('hero3d-on', 'hero3d-ready');
  root.classList.add('hero3d-fallback');
}

/* -----------------------------------------------------------------------------
   Math helpers
   -------------------------------------------------------------------------- */
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const damp = (k, dt) => 1 - Math.pow(1 - k, dt * 60);       // frame-rate independent lerp factor
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOut3 = (x) => 1 - Math.pow(1 - x, 3);
const lin = (s, w) => clamp01((s - w[0]) / (w[1] - w[0]));     // linear 0..1 inside a window
const win = (s, w) => easeInOut(lin(s, w));                    // eased 0..1 inside a window
const bump = (x) => Math.sin(Math.PI * clamp01(x));            // 0 → 1 → 0

function debounce(fn, ms) {
  let id;
  return (...a) => { clearTimeout(id); id = setTimeout(() => fn(...a), ms); };
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mixHex(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`;
}

/* -----------------------------------------------------------------------------
   2D canvas helpers (screens)
   -------------------------------------------------------------------------- */
function rr(ctx, x, y, w, h, r) {
  const [tl, tr, br, bl] = Array.isArray(r) ? r : [r, r, r, r];
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.arcTo(x + w, y, x + w, y + h, tr);
  ctx.arcTo(x + w, y + h, x, y + h, br);
  ctx.arcTo(x, y + h, x, y, bl);
  ctx.arcTo(x, y, x + w, y, tl);
  ctx.closePath();
}

// Cheap soft shadow: a few offset translucent fills (shadowBlur is slow).
function softShadow(ctx, x, y, w, h, r, strength = 1) {
  for (let i = 3; i >= 1; i--) {
    ctx.fillStyle = `rgba(31,77,63,${0.035 * strength})`;
    rr(ctx, x - i, y + i * 1.6, w + i * 2, h + i, r + i);
    ctx.fill();
  }
}

const font = (weight, size) => `${weight} ${size}px ${CONFIG.ui.font}`;

const wrapCache = new Map();
function wrapText(ctx, text, maxW) {
  const key = ctx.font + '|' + maxW + '|' + text;
  if (wrapCache.has(key)) return wrapCache.get(key);
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  wrapCache.set(key, lines);
  return lines;
}

function checkMark(ctx, cx, cy, size, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.45, cy + size * 0.02);
  ctx.lineTo(cx - size * 0.12, cy + size * 0.32);
  ctx.lineTo(cx + size * 0.48, cy - size * 0.3);
  ctx.stroke();
}

/* -----------------------------------------------------------------------------
   Screen: a CanvasTexture redrawn from (story, time)
   -------------------------------------------------------------------------- */
class Screen {
  constructor({ size, base, draw, mipmaps, anisotropy, fps }) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = size[0];
    this.canvas.height = size[1];
    this.ctx = this.canvas.getContext('2d');
    this.scale = size[0] / base[0];
    this.draw = draw;
    this.interval = 1 / fps;
    this.fps = fps;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = anisotropy;
    this.texture.generateMipmaps = mipmaps;
    this.texture.minFilter = mipmaps ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
    this.key = '';
    this.last = -1;
    this.live = true;
  }

  // Redraws only when the story moved or a live detail ticked, capped at fps.
  update(story, time, force = false) {
    if (!force && time - this.last < this.interval) return;
    const key = Math.round(story * 500) + ':' + (this.live ? Math.floor(time * this.fps) : 0);
    if (!force && key === this.key) return;
    this.key = key;
    this.last = time;
    const ctx = this.ctx;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    this.live = this.draw(ctx, story, time);
    this.texture.needsUpdate = true;
  }

  dispose() { this.texture.dispose(); }
}

/* -----------------------------------------------------------------------------
   PHONE UI (base 600 × 1200)
   -------------------------------------------------------------------------- */
function drawPhone(ctx, s, t) {
  const U = CONFIG.ui, C = CONFIG.chat, S = CONFIG.story;
  const W = 600;
  let live = false;

  ctx.fillStyle = U.bg;
  ctx.fillRect(0, 0, W, 1200);

  // Status bar
  ctx.fillStyle = U.text;
  ctx.font = font(600, 22);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText('9:41', 44, 38);
  for (let i = 0; i < 4; i++) { rr(ctx, 452 + i * 10, 44 - (i + 1) * 4.5, 6, (i + 1) * 4.5, 2); ctx.fill(); }
  rr(ctx, 500, 28, 44, 21, 6); ctx.lineWidth = 2; ctx.strokeStyle = U.text; ctx.stroke();
  rr(ctx, 504, 32, 30, 13, 3); ctx.fill();

  // Header: avatar, name, online dot
  ctx.fillStyle = U.text;
  ctx.beginPath(); ctx.arc(84, 122, 36, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = U.bg;
  ctx.font = font(600, 30);
  ctx.textAlign = 'center';
  ctx.fillText('A', 84, 123);
  ctx.beginPath(); ctx.arc(84, 122, 36, -0.6, 0.6); ctx.lineWidth = 3; ctx.strokeStyle = U.accent; ctx.stroke();
  ctx.fillStyle = U.bg; ctx.beginPath(); ctx.arc(110, 150, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = U.online; ctx.beginPath(); ctx.arc(110, 150, 7.5, 0, Math.PI * 2); ctx.fill();
  ctx.textAlign = 'left';
  ctx.fillStyle = U.text;
  ctx.font = font(600, 29);
  ctx.fillText(C.appName, 140, 108);
  ctx.fillStyle = U.muted;
  ctx.font = font(400, 20);
  ctx.fillText(C.status, 140, 142);
  ctx.fillStyle = U.line;
  ctx.fillRect(0, 186, W, 2);

  // ----- Chat -----
  const top = 190, bottom = 1060, gap = 18;
  const bubbleFont = font(400, 25), lineH = 34, padX = 24, padY = 18, maxText = 392;

  const bubbleSize = (text) => {
    ctx.font = bubbleFont;
    const lines = wrapText(ctx, text, maxText);
    const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + padX * 2;
    return { lines, w, h: lines.length * lineH + padY * 2 };
  };

  const drawBubble = (text, y, side) => {
    const b = bubbleSize(text);
    const x = side === 'left' ? 32 : W - 32 - b.w;
    const r = side === 'left' ? [8, 26, 26, 26] : [26, 8, 26, 26];
    if (side === 'left') { softShadow(ctx, x, y, b.w, b.h, 24); ctx.fillStyle = U.surface; }
    else ctx.fillStyle = U.text;
    rr(ctx, x, y, b.w, b.h, r);
    ctx.fill();
    ctx.fillStyle = side === 'left' ? U.text : U.bg;
    ctx.font = bubbleFont;
    ctx.textAlign = 'left';
    b.lines.forEach((l, i) => ctx.fillText(l, x + padX, y + padY + lineH * i + lineH / 2));
  };

  const items = [];
  // 1. greeting
  items.push({ a: 1, h: bubbleSize(C.greeting).h, draw: (y) => drawBubble(C.greeting, y, 'left') });
  // 2. client message lands
  items.push({ a: win(s, S.send), h: bubbleSize(C.clientMessage).h, draw: (y) => drawBubble(C.clientMessage, y, 'right') });
  // 3. typing dots
  const dots = win(s, S.dotsIn) * (1 - win(s, S.dotsOut));
  if (dots > 0.01) live = true;
  items.push({
    a: dots, h: 66,
    draw: (y) => {
      softShadow(ctx, 32, y, 108, 66, 24);
      ctx.fillStyle = U.surface; rr(ctx, 32, y, 108, 66, [8, 26, 26, 26]); ctx.fill();
      for (let i = 0; i < 3; i++) {
        const p = 0.5 + 0.5 * Math.sin(t * 6 - i * 0.8);
        ctx.fillStyle = mixHex(U.idle, U.text, p);
        ctx.beginPath(); ctx.arc(62 + i * 24, y + 33 - p * 5, 7, 0, Math.PI * 2); ctx.fill();
      }
    },
  });
  // 4. reply
  items.push({ a: win(s, S.reply), h: bubbleSize(C.reply).h, draw: (y) => drawBubble(C.reply, y, 'left') });
  // 5. time chips
  const chipsIn = lin(s, S.chips);
  const tap = lin(s, S.tap);
  const chipH = 62, chipGap = 12, chipW = 300;
  items.push({
    a: easeInOut(clamp01(chipsIn * 3)), h: C.slots.length * (chipH + chipGap) - chipGap,
    draw: (y) => {
      const outer = ctx.globalAlpha;
      C.slots.forEach((label, i) => {
        const ca = easeInOut(clamp01(chipsIn * 1.6 - i * 0.3));
        if (ca <= 0) return;
        const cy = y + i * (chipH + chipGap) + (1 - ca) * 14;
        const x = 32;
        const selected = i === C.pick ? easeInOut(clamp01((tap - 0.35) / 0.4)) : 0;
        ctx.globalAlpha = outer * ca;
        ctx.fillStyle = selected > 0 ? mixHex('#FFFFFF', U.accent, selected) : U.surface;
        rr(ctx, x, cy, chipW, chipH, 31); ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = selected > 0.5 ? U.accent : 'rgba(31,77,63,0.28)';
        rr(ctx, x + 1, cy + 1, chipW - 2, chipH - 2, 30); ctx.stroke();
        // tap ripple
        if (i === C.pick && tap > 0 && tap < 1) {
          ctx.save();
          rr(ctx, x, cy, chipW, chipH, 31); ctx.clip();
          ctx.fillStyle = `rgba(232,151,58,${0.35 * (1 - tap)})`;
          ctx.beginPath(); ctx.arc(x + chipW * 0.62, cy + chipH / 2, 20 + easeOut3(tap) * 190, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
        ctx.fillStyle = selected > 0.5 ? '#FFFFFF' : U.text;
        ctx.font = font(600, 23);
        ctx.textAlign = 'center';
        ctx.fillText(label, x + chipW / 2, cy + chipH / 2 + 1);
      });
      ctx.globalAlpha = outer;
    },
  });
  // 6. picked message
  items.push({ a: win(s, S.picked), h: bubbleSize(C.pickedMessage).h, draw: (y) => drawBubble(C.pickedMessage, y, 'right') });
  // 7. booked card
  items.push({
    a: win(s, S.booked), h: 196,
    draw: (y) => {
      const x = 32, w = 452, h = 196;
      softShadow(ctx, x, y, w, h, 26, 1.4);
      ctx.fillStyle = U.surface; rr(ctx, x, y, w, h, 26); ctx.fill();
      ctx.fillStyle = U.success; rr(ctx, x, y, 8, h, [26, 0, 0, 26]); ctx.fill();
      ctx.fillStyle = 'rgba(47,138,95,0.12)';
      ctx.beginPath(); ctx.arc(x + 62, y + 62, 32, 0, Math.PI * 2); ctx.fill();
      checkMark(ctx, x + 62, y + 62, 30, U.success, 5);
      ctx.textAlign = 'left';
      ctx.fillStyle = U.text; ctx.font = font(600, 29); ctx.fillText(C.bookedTitle, x + 112, y + 50);
      ctx.fillStyle = U.muted; ctx.font = font(400, 22); ctx.fillText(C.bookedDetail, x + 112, y + 84);
      ctx.fillStyle = U.line; ctx.fillRect(x + 28, y + 122, w - 56, 2);
      ctx.fillStyle = U.muted; ctx.font = font(400, 20); ctx.fillText(C.bookedNote, x + 28, y + 160);
      ctx.fillStyle = U.accent; ctx.font = font(600, 20); ctx.textAlign = 'right'; ctx.fillText('Add to calendar', x + w - 28, y + 160);
    },
  });

  // Heights grow with each item's appear value, so the list (and its scroll)
  // moves smoothly in both directions.
  let total = 20;
  for (const it of items) total += (it.h + gap) * it.a;
  const offset = Math.max(0, total - (bottom - top) + 10);

  ctx.save();
  ctx.beginPath(); ctx.rect(0, top, W, bottom - top); ctx.clip();
  let y = top + 20 - offset;
  for (const it of items) {
    if (it.a > 0.002) {
      ctx.globalAlpha = it.a;
      it.draw(y + (1 - it.a) * 22);
      ctx.globalAlpha = 1;
    }
    y += (it.h + gap) * it.a;
  }
  ctx.restore();

  // ----- Input bar: the client types here, then it sends -----
  const typed = lin(s, S.typing);
  const inputFade = 1 - win(s, S.send);
  ctx.fillStyle = U.line; ctx.fillRect(0, 1060, W, 2);
  softShadow(ctx, 28, 1084, 466, 76, 38);
  ctx.fillStyle = U.surface; rr(ctx, 28, 1084, 466, 76, 38); ctx.fill();
  ctx.textAlign = 'left';
  ctx.font = font(400, 24);
  const n = Math.round(C.clientMessage.length * typed);
  if (n > 0 && inputFade > 0.01) {
    let text = C.clientMessage.slice(0, n);
    const maxW = 400;
    if (ctx.measureText(text).width > maxW) {
      while (text.length && ctx.measureText('…' + text).width > maxW) text = text.slice(1);
      text = '…' + text;
    }
    ctx.globalAlpha = inputFade;
    ctx.fillStyle = U.text;
    ctx.fillText(text, 58, 1123);
    const cursorOn = typed < 1 || Math.floor(t * 1.9) % 2 === 0;
    if (cursorOn) { ctx.fillStyle = U.accent; ctx.fillRect(58 + ctx.measureText(text).width + 3, 1106, 3, 34); }
    ctx.globalAlpha = 1;
    live = true;
  } else {
    ctx.fillStyle = U.muted;
    ctx.fillText(C.placeholder, 58, 1123);
  }
  // send button presses as the message sends
  const press = bump(lin(s, [S.send[0] - 0.04, S.send[0] + 0.08]));
  ctx.fillStyle = U.accent;
  ctx.beginPath(); ctx.arc(546, 1122, 38 * (1 - press * 0.12), 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(532, 1122); ctx.lineTo(560, 1122); ctx.moveTo(548, 1110); ctx.lineTo(560, 1122); ctx.lineTo(548, 1134); ctx.stroke();

  // ----- Notification banner slides down -----
  const nb = win(s, S.notification);
  if (nb > 0.002) {
    const by = lerp(-150, 24, easeOut3(nb));
    ctx.globalAlpha = nb;
    softShadow(ctx, 20, by, 560, 118, 28, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.98)'; rr(ctx, 20, by, 560, 118, 28); ctx.fill();
    ctx.fillStyle = U.text; rr(ctx, 42, by + 26, 64, 64, 16); ctx.fill();
    ctx.fillStyle = U.bg; ctx.font = font(600, 28); ctx.textAlign = 'center'; ctx.fillText('A', 74, by + 59);
    ctx.textAlign = 'left';
    ctx.fillStyle = U.text; ctx.font = font(600, 22); ctx.fillText(C.notifyTitle, 126, by + 44);
    ctx.fillStyle = U.muted; ctx.font = font(400, 19); ctx.textAlign = 'right'; ctx.fillText('now', 552, by + 44);
    ctx.textAlign = 'left'; ctx.fillStyle = U.text; ctx.font = font(400, 22); ctx.fillText(C.notifyBody, 126, by + 80);
    ctx.globalAlpha = 1;
  }

  return live;
}

/* -----------------------------------------------------------------------------
   LAPTOP UI (base 1280 × 800)
   -------------------------------------------------------------------------- */
function agentState(s, i) {
  const S = CONFIG.story;
  const on = [S.receptionist, S.scheduler, S.followUp][i];
  const off = [S.receptionistDone, S.schedulerDone, S.followUpDone][i];
  const done = win(s, off);
  return { working: win(s, on) * (1 - done), done };
}

function drawLaptop(ctx, s, t) {
  const U = CONFIG.ui, D = CONFIG.dashboard, S = CONFIG.story;
  const W = 1280;
  let live = false;

  ctx.fillStyle = U.bg;
  ctx.fillRect(0, 0, W, 800);

  // Window bar
  ctx.fillStyle = U.surfaceAlt;
  ctx.fillRect(0, 0, W, 44);
  ['#E8973A', '#C9BFAE', '#C9BFAE'].forEach((c, i) => {
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(28 + i * 22, 22, 7, 0, Math.PI * 2); ctx.fill();
  });
  ctx.fillStyle = U.muted; ctx.font = font(500, 16); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('agents.aiquor.app', W / 2, 23);

  // Header
  ctx.textAlign = 'left';
  ctx.fillStyle = U.text; ctx.font = font(600, 34); ctx.fillText(D.title, 48, 84);
  ctx.fillStyle = U.muted; ctx.font = font(400, 18); ctx.fillText(D.subtitle, 48, 118);
  ctx.font = font(600, 16);
  const pillW = ctx.measureText(D.online).width + 52;
  ctx.fillStyle = 'rgba(59,178,115,0.12)'; rr(ctx, 832 - pillW, 66, pillW, 38, 19); ctx.fill();
  ctx.fillStyle = U.online; ctx.beginPath(); ctx.arc(832 - pillW + 22, 85, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = U.text; ctx.fillText(D.online, 832 - pillW + 36, 86);

  // Agent cards
  const cardY = 146, cardW = 240, cardH = 196, cardGap = 32;
  const states = D.agents.map((_, i) => agentState(s, i));
  D.agents.forEach((ag, i) => {
    const x = 48 + i * (cardW + cardGap);
    const st = states[i];
    softShadow(ctx, x, cardY, cardW, cardH, 20, 1.2);
    ctx.fillStyle = U.surface; rr(ctx, x, cardY, cardW, cardH, 20); ctx.fill();
    if (st.working > 0.01) {
      ctx.globalAlpha = st.working;
      ctx.lineWidth = 3; ctx.strokeStyle = U.accent;
      rr(ctx, x + 1.5, cardY + 1.5, cardW - 3, cardH - 3, 19); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = U.text; rr(ctx, x + 22, cardY + 22, 48, 48, 14); ctx.fill();
    ctx.fillStyle = U.bg; ctx.font = font(600, 22); ctx.textAlign = 'center'; ctx.fillText(ag.initial, x + 46, cardY + 47);
    ctx.textAlign = 'left';
    ctx.fillStyle = U.text; ctx.font = font(600, 20); ctx.fillText(ag.name, x + 22, cardY + 98);
    ctx.fillStyle = U.muted; ctx.font = font(400, 15); ctx.fillText(ag.role, x + 22, cardY + 124);

    // status: idle grey → working orange (pulse ring) → done green check
    const sy = cardY + 162, sx = x + 32;
    const dotColor = st.done > 0.5 ? mixHex(U.accent, U.success, clamp01(st.done * 2 - 1))
                                   : mixHex(U.idle, U.accent, clamp01(st.working * 2));
    if (st.working > 0.3) {
      live = true;
      const ph = (t * 0.9) % 1;
      ctx.fillStyle = `rgba(232,151,58,${0.35 * (1 - ph) * st.working})`;
      ctx.beginPath(); ctx.arc(sx, sy, 8 + ph * 14, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = dotColor;
    ctx.beginPath(); ctx.arc(sx, sy, 8 + st.done * 5, 0, Math.PI * 2); ctx.fill();
    if (st.done > 0.05) {
      ctx.globalAlpha = st.done;
      checkMark(ctx, sx, sy, 11, '#FFFFFF', 2.6);
      ctx.globalAlpha = 1;
    }
    const label = st.done > 0.5 ? 'Done' : st.working > 0.5 ? 'Working…' : 'Idle';
    ctx.fillStyle = st.working > 0.5 ? U.accent : st.done > 0.5 ? U.success : U.muted;
    ctx.font = font(600, 16);
    ctx.fillText(label, sx + 22, sy + 1);
  });

  // Handoff connector: Receptionist → Scheduler, curving under the cards
  const ho = win(s, S.handoff);
  if (ho > 0.002) {
    const x0 = 48 + cardW / 2, x1 = 48 + cardW + cardGap + cardW / 2, y0 = cardY + cardH;
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const u = i / 40;
      pts.push([
        (1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * ((x0 + x1) / 2) + u * u * x1,
        (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * (y0 + 52) + u * u * y0,
      ]);
    }
    const nPts = Math.max(1, Math.round(ho * 40));
    ctx.strokeStyle = U.accent; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.globalAlpha = lerp(1, 0.45, win(s, [S.scheduler[1], S.scheduler[1] + 0.2]));
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i <= nPts; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
    ctx.fillStyle = U.accent; ctx.beginPath(); ctx.arc(pts[nPts][0], pts[nPts][1], 6, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Calendar panel
  const px = 48, py = 380, pw = 784, ph = 372;
  softShadow(ctx, px, py, pw, ph, 20, 1.2);
  ctx.fillStyle = U.surface; rr(ctx, px, py, pw, ph, 20); ctx.fill();
  ctx.fillStyle = U.text; ctx.font = font(600, 20); ctx.textAlign = 'left';
  ctx.fillText(D.calendarTitle, px + 28, py + 38);

  const calIn = win(s, S.calendarIn);
  if (calIn < 1) {
    ctx.globalAlpha = 1 - calIn;
    ctx.fillStyle = U.muted; ctx.font = font(400, 18); ctx.textAlign = 'center';
    ctx.fillText(D.calendarIdle, px + pw / 2, py + ph / 2 + 10);
    ctx.globalAlpha = 1;
  }
  if (calIn > 0.002) {
    ctx.globalAlpha = calIn;
    const gx = px + 110, gy = py + 92, cw = 128, ch = 62;
    ctx.font = font(600, 15); ctx.textAlign = 'center'; ctx.fillStyle = U.muted;
    D.days.forEach((d, i) => ctx.fillText(d, gx + i * cw + cw / 2, gy - 18));
    ctx.textAlign = 'right';
    D.times.forEach((tm, j) => ctx.fillText(tm, gx - 18, gy + j * ch + ch / 2));
    const scan = lin(s, S.scan);
    const scanned = scan * D.days.length * D.times.length;
    const pickSel = win(s, S.picked);
    for (let j = 0; j < D.times.length; j++) {
      for (let d = 0; d < D.days.length; d++) {
        const idx = j * D.days.length + d;
        const cx = gx + d * cw + 5, cy = gy + j * ch + 5, w = cw - 10, h = ch - 10;
        const seen = clamp01(scanned - idx);
        const open = D.openSlots.findIndex(([od, oj]) => od === d && oj === j);
        let fill = open >= 0 ? mixHex('#F5F1E8', '#DDEFE4', seen) : mixHex('#F5F1E8', '#E7E1D4', seen);
        if (open === CONFIG.chat.pick && pickSel > 0) fill = mixHex('#DDEFE4', U.accent, pickSel);
        ctx.fillStyle = fill; rr(ctx, cx, cy, w, h, 12); ctx.fill();
        const cur = scanned - idx;
        if (cur > 0 && cur < 1 && scan < 1) {
          ctx.strokeStyle = `rgba(232,151,58,${0.9 * bump(cur)})`; ctx.lineWidth = 3;
          rr(ctx, cx + 1.5, cy + 1.5, w - 3, h - 3, 11); ctx.stroke();
        }
        if (open >= 0 && seen > 0.5) {
          ctx.globalAlpha = calIn * clamp01(seen * 2 - 1);
          const sel = open === CONFIG.chat.pick ? pickSel : 0;
          ctx.fillStyle = sel > 0.5 ? '#FFFFFF' : U.success;
          ctx.font = font(600, 15); ctx.textAlign = 'center';
          ctx.fillText(sel > 0.5 ? 'Booked' : 'Open', cx + w / 2, cy + h / 2 + 1);
          ctx.globalAlpha = calIn;
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  // Summary banner (finale)
  const sm = win(s, S.summary);
  if (sm > 0.002) {
    const by = py + ph - 86 + (1 - sm) * 24;
    ctx.globalAlpha = sm;
    ctx.fillStyle = U.text; rr(ctx, px + 20, by, pw - 40, 66, 16); ctx.fill();
    ctx.fillStyle = U.accent; ctx.beginPath(); ctx.arc(px + 58, by + 33, 17, 0, Math.PI * 2); ctx.fill();
    checkMark(ctx, px + 58, by + 33, 16, '#FFFFFF', 3);
    ctx.fillStyle = U.bg; ctx.font = font(600, 22); ctx.textAlign = 'left';
    ctx.fillText(D.summary, px + 90, by + 34);
    ctx.globalAlpha = 1;
  }

  // Live activity log
  const lx = 864, ly = 146, lw = 368, lh = 606;
  softShadow(ctx, lx, ly, lw, lh, 20, 1.2);
  ctx.fillStyle = U.surface; rr(ctx, lx, ly, lw, lh, 20); ctx.fill();
  ctx.fillStyle = U.text; ctx.font = font(600, 20); ctx.textAlign = 'left';
  ctx.fillText(D.logTitle, lx + 28, ly + 40);
  const anyWorking = states.some((st) => st.working > 0.3);
  if (anyWorking) live = true;
  ctx.fillStyle = anyWorking ? `rgba(232,151,58,${0.55 + 0.45 * Math.sin(t * 4)})` : U.online;
  ctx.beginPath(); ctx.arc(lx + lw - 34, ly + 40, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = U.line; ctx.fillRect(lx + 28, ly + 68, lw - 56, 2);

  const entries = CONFIG.log.map((e) => ({ ...e, a: win(s, [e.at, e.at + 0.06]) }));
  if (entries[0].a < 1) {
    ctx.globalAlpha = 1 - entries[0].a;
    ctx.fillStyle = U.muted; ctx.font = font(400, 17);
    ctx.fillText(D.logIdle, lx + 28, ly + 108);
    ctx.globalAlpha = 1;
  }
  entries.forEach((e, i) => {
    if (e.a <= 0.002) return;
    const ey = ly + 104 + i * 50;
    const ex = lx + 28 + (1 - e.a) * 16;
    ctx.globalAlpha = e.a;
    ctx.fillStyle = /✓|booked/i.test(e.text) ? U.success : U.accent;
    ctx.beginPath(); ctx.arc(ex + 5, ey, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = U.muted; ctx.font = font(500, 14);
    ctx.fillText(`09:41:${String(2 + i * 4).padStart(2, '0')}`, ex + 20, ey + 1);
    ctx.fillStyle = U.text; ctx.font = font(500, 16);
    ctx.fillText(e.text, ex + 96, ey + 1);
    ctx.globalAlpha = 1;
  });

  return live;
}

/* -----------------------------------------------------------------------------
   Generated textures and shapes
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

// Mobile keyboard: one textured plane instead of 70 keys.
function keyboardTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 352;
  const g = c.getContext('2d');
  g.fillStyle = '#17241d';               // dark gaps between keys
  g.fillRect(0, 0, c.width, c.height);
  const cols = 14, rows = 5, pw = c.width / cols, ph = c.height / rows;
  g.fillStyle = CONFIG.colors.deviceDeep;
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < cols; k++) {
      if (r === rows - 1 && k >= 4 && k <= 9) continue;
      rr(g, k * pw + 5, r * ph + 5, pw - 10, ph - 10, 9); g.fill();
    }
  }
  rr(g, 4 * pw + 5, 4 * ph + 5, pw * 6 - 10, ph - 10, 9); g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// ShapeGeometry with UVs normalised to 0..1 so a texture fills it.
function roundedScreenGeometry(w, h, r) {
  const geo = new THREE.ShapeGeometry(roundedRectShape(w, h, r), 10);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
  return geo;
}

/* -----------------------------------------------------------------------------
   Devices
   -------------------------------------------------------------------------- */
function buildLaptop(mats, screen, mobile) {
  const rb = (w, h, d, r, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, r);
  const laptop = new THREE.Group();
  const W = 3.0, D = 2.0, H = 0.09;

  const base = new THREE.Mesh(rb(W, H, D, 0.04, 4), mats.body);
  base.position.y = H / 2;
  laptop.add(base);

  // Keyboard
  const kbZ = -0.4;
  if (mobile) {
    const kb = new THREE.Mesh(new THREE.PlaneGeometry(2.66, 0.92), new THREE.MeshStandardMaterial({
      map: keyboardTexture(), roughness: 0.7, emissive: CONFIG.colors.accent, emissiveIntensity: 0.03,
    }));
    kb.rotation.x = -Math.PI / 2;
    kb.position.set(0, H + 0.002, kbZ);
    laptop.add(kb);
  } else {
    // Faint orange backlight, visible only in the gaps between keys
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.88), mats.backlight);
    glow.rotation.x = -Math.PI / 2;
    glow.position.set(0, H + 0.001, kbZ);
    laptop.add(glow);

    const pitch = 0.19, key = 0.155, rows = 5, cols = 14;
    const keys = new THREE.InstancedMesh(rb(key, 0.024, key, 0.011, 2), mats.keys, rows * cols);
    const m = new THREE.Matrix4();
    let n = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (r === rows - 1 && c >= 4 && c <= 9) continue;  // space bar slot
        m.setPosition((c - (cols - 1) / 2) * pitch, H + 0.014, kbZ + (r - (rows - 1) / 2) * 0.18);
        keys.setMatrixAt(n++, m);
      }
    }
    keys.count = n;
    laptop.add(keys);
    const space = new THREE.Mesh(rb(pitch * 6 - (pitch - key), 0.024, key, 0.011, 2), mats.keys);
    space.position.set(0, H + 0.014, kbZ + 2 * 0.18);
    laptop.add(space);
  }

  const pad = new THREE.Mesh(rb(1.0, 0.008, 0.56, 0.0035, 2), mats.trackpad);
  pad.position.set(0, H + 0.001, 0.6);
  laptop.add(pad);

  // Orange edge strip along the front of the base
  const strip = new THREE.Mesh(rb(2.5, 0.012, 0.012, 0.005, 2), mats.accent);
  strip.position.set(0, H * 0.5, D / 2 + 0.002);
  laptop.add(strip);

  const hinge = new THREE.Mesh(rb(2.3, 0.08, 0.08, 0.035, 3), mats.deep);
  hinge.position.set(0, H + 0.02, -D / 2 + 0.05);
  laptop.add(hinge);

  // Lid pivots at the back edge
  const lid = new THREE.Group();
  lid.position.set(0, H + 0.03, -D / 2 + 0.05);
  laptop.add(lid);

  const LH = 1.95, LD = 0.05;
  const shell = new THREE.Mesh(rb(W, LH, LD, 0.022, 4), mats.body);
  shell.position.y = LH / 2;
  lid.add(shell);

  const SW = 2.84, SH = 1.775, sy = LH / 2 + 0.03;
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), screen.material);
  screenMesh.position.set(0, sy, LD / 2 + 0.002);
  lid.add(screenMesh);

  // Thin orange frame around the screen bezel
  const frameShape = roundedRectShape(SW + 0.03, SH + 0.03, 0.02);
  frameShape.holes.push(roundedRectShape(SW + 0.004, SH + 0.004, 0.01));
  const frame = new THREE.Mesh(new THREE.ShapeGeometry(frameShape, 4), mats.accentFlat);
  frame.position.set(0, sy, LD / 2 + 0.0015);
  lid.add(frame);

  // Where the connection curve meets the laptop (left edge of the screen)
  const anchor = new THREE.Object3D();
  anchor.position.set(-SW / 2 + 0.1, sy + 0.2, LD / 2 + 0.02);
  lid.add(anchor);

  // Soft light spill from the screen onto the keyboard
  const spill = new THREE.PointLight('#FFF1DE', 0, 3.2, 2);
  spill.position.set(0, 0.7, 0.75);
  lid.add(spill);

  return { laptop, lid, anchor, spill };
}

function buildPhone(mats, screen) {
  const phone = new THREE.Group();
  const w = 0.74, h = 1.5, depth = 0.045, bevel = 0.012, r = 0.11;

  const bodyGeo = new THREE.ExtrudeGeometry(roundedRectShape(w, h, r), {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 10,
  });
  bodyGeo.translate(0, 0, -depth / 2);
  phone.add(new THREE.Mesh(bodyGeo, mats.body));

  // Orange side-frame accent: a thin ring that peeks out of the edge
  const ringShape = roundedRectShape(w + bevel * 2 + 0.006, h + bevel * 2 + 0.006, r + bevel);
  ringShape.holes.push(roundedRectShape(w + bevel * 2 - 0.01, h + bevel * 2 - 0.01, r + bevel - 0.008));
  const ringGeo = new THREE.ExtrudeGeometry(ringShape, { depth: 0.012, bevelEnabled: false, curveSegments: 10 });
  ringGeo.translate(0, 0, -0.006);
  phone.add(new THREE.Mesh(ringGeo, mats.accent));

  const SW = 0.68, SH = 1.36;
  const scr = new THREE.Mesh(roundedScreenGeometry(SW, SH, 0.085), screen.material);
  scr.position.z = depth / 2 + bevel + 0.001;
  phone.add(scr);

  // Camera island on the back
  const island = new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.24, 0.02, 3, 0.008), mats.deep);
  island.position.set(-0.17, 0.5, -(depth / 2 + bevel + 0.008));
  phone.add(island);
  const lensGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.012, 20);
  [[-0.215, 0.545], [-0.125, 0.455]].forEach(([x, y]) => {
    const lens = new THREE.Mesh(lensGeo, mats.lens);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(x, y, -(depth / 2 + bevel + 0.02));
    phone.add(lens);
  });

  const anchor = new THREE.Object3D();
  anchor.position.set(SW / 2 - 0.05, 0.1, 0.05);
  phone.add(anchor);

  return { phone, anchor };
}

/* -----------------------------------------------------------------------------
   Main
   -------------------------------------------------------------------------- */
let app = null;

function flatStep(step, mode, story) {
  const f = step.frame[mode];
  const zoom = mode === 'stacked' ? (step.stackedZoom || 1) : 1;
  const cp = step.camera.position, cl = step.camera.lookAt;
  return {
    cpx: cl[0] + (cp[0] - cl[0]) * zoom, cpy: cl[1] + (cp[1] - cl[1]) * zoom, cpz: cl[2] + (cp[2] - cl[2]) * zoom,
    clx: cl[0], cly: cl[1], clz: cl[2],
    lpx: step.laptop.position[0], lpy: step.laptop.position[1], lpz: step.laptop.position[2],
    lrx: step.laptop.rotation[0], lry: step.laptop.rotation[1], lrz: step.laptop.rotation[2],
    ppx: step.phone.position[0], ppy: step.phone.position[1], ppz: step.phone.position[2],
    prx: step.phone.rotation[0], pry: step.phone.rotation[1], prz: step.phone.rotation[2],
    fx: f.x, fy: f.y,
    story,
  };
}

async function init() {
  if (!wrap || !canvas) return;

  const reduced = mqReduced.matches;
  const mobile = isMobileTier();

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      // At 2x pixel ratio the extra pixels already smooth edges; skip MSAA there.
      antialias: (window.devicePixelRatio || 1) < 2,
      powerPreference: 'high-performance',
    });
  } catch (e) {
    fail();
    return;
  }

  // Draw the screens with the site font, not a fallback.
  try {
    await Promise.race([
      Promise.all([document.fonts.load(font(400, 24)), document.fonts.load(font(500, 24)), document.fonts.load(font(600, 24))]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch (e) { /* draw with the fallback font */ }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = CONFIG.render.exposure;
  renderer.setClearColor(0x000000, 0);   // transparent: the CSS background shows through

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(CONFIG.colors.background, CONFIG.render.fogNear, CONFIG.render.fogFar);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomEnv = new RoomEnvironment();
  const envRT = pmrem.fromScene(roomEnv, 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = CONFIG.render.envIntensity;
  roomEnv.dispose();
  pmrem.dispose();

  // Lighting: warm key, low fill, cream rim from behind
  const C = CONFIG.colors;
  scene.add(new THREE.HemisphereLight('#DCE8E1', '#0B1913', 0.3));
  const key = new THREE.DirectionalLight(C.keyLight, 1.5); key.position.set(-4, 6, 5); scene.add(key);
  const fill = new THREE.DirectionalLight(C.fillLight, 0.25); fill.position.set(5, 2, 4); scene.add(fill);
  const rim = new THREE.DirectionalLight(C.rimLight, 1.7); rim.position.set(0.5, 3.5, -6); scene.add(rim);

  const camera = new THREE.PerspectiveCamera(CONFIG.render.fov, 1, 0.1, 60);

  // Shared materials
  const mats = {
    body:       new THREE.MeshStandardMaterial({ color: C.device, roughness: 0.5, metalness: 0.25 }),
    deep:       new THREE.MeshStandardMaterial({ color: C.deviceDeep, roughness: 0.55, metalness: 0.2 }),
    keys:       new THREE.MeshStandardMaterial({ color: C.deviceDeep, roughness: 0.7, metalness: 0.08 }),
    trackpad:   new THREE.MeshStandardMaterial({ color: C.trackpad, roughness: 0.35, metalness: 0.2 }),
    accent:     new THREE.MeshStandardMaterial({ color: C.accent, emissive: C.accent, emissiveIntensity: 0.9, roughness: 0.4 }),
    accentFlat: new THREE.MeshBasicMaterial({ color: C.accent, toneMapped: false, transparent: true, opacity: 0.85 }),
    backlight:  new THREE.MeshBasicMaterial({ color: '#3d2510', toneMapped: false }),
    lens:       new THREE.MeshStandardMaterial({ color: '#0d1a15', roughness: 0.15, metalness: 0.6 }),
  };

  // Screens
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const fps = mobile ? CONFIG.mobile.screenFps : CONFIG.render.screenFps;
  const phoneScreen = new Screen({
    size: mobile ? CONFIG.mobile.phoneCanvas : CONFIG.desktopCanvas.phone, base: [600, 1200],
    draw: drawPhone, mipmaps: !mobile, anisotropy: aniso, fps,
  });
  const laptopScreen = new Screen({
    size: mobile ? CONFIG.mobile.laptopCanvas : CONFIG.desktopCanvas.laptop, base: [1280, 800],
    draw: drawLaptop, mipmaps: !mobile, anisotropy: aniso, fps,
  });
  [phoneScreen, laptopScreen].forEach((sc) => {
    sc.material = new THREE.MeshBasicMaterial({ map: sc.texture, toneMapped: false, color: 0x000000 });
  });

  // Scene graph: world (mouse) > rig (scroll) > float (idle) > device
  const world = new THREE.Group();
  scene.add(world);

  const laptopRig = new THREE.Group(), laptopFloat = new THREE.Group();
  laptopRig.add(laptopFloat); world.add(laptopRig);
  const L = buildLaptop(mats, laptopScreen, mobile);
  laptopFloat.add(L.laptop);

  const phoneRig = new THREE.Group(), phoneFloat = new THREE.Group();
  phoneRig.add(phoneFloat); world.add(phoneRig);
  const P = buildPhone(mats, phoneScreen);
  phoneFloat.add(P.phone);

  // Contact shadows (blurred radial planes, no shadow maps)
  const shadowTex = radialTexture(128, [[0, 'rgba(0,0,0,0.5)'], [0.5, 'rgba(0,0,0,0.24)'], [1, 'rgba(0,0,0,0)']]);
  const shadowMat = (o) => new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: o });
  const laptopShadow = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 3.3), shadowMat(1));
  laptopShadow.rotation.x = -Math.PI / 2;
  laptopShadow.position.y = -0.01;
  laptopRig.add(laptopShadow);
  const phoneShadow = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.1), shadowMat(0.5));
  phoneShadow.rotation.x = -Math.PI / 2;
  world.add(phoneShadow);

  // Halo sprites (desktop only): glow under the laptop's orange strip, and on the pulse
  const haloTex = radialTexture(128, [[0, 'rgba(232,151,58,1)'], [0.4, 'rgba(232,151,58,0.35)'], [1, 'rgba(232,151,58,0)']]);
  if (!mobile) {
    const stripHalo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: haloTex, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    stripHalo.scale.set(2.8, 0.35, 1);
    stripHalo.position.set(0, 0.05, 1.05);
    L.laptop.add(stripHalo);
  }

  // Connection curve + pulse
  const CURVE_POINTS = 48;
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]);
  const linePos = new Float32Array(CURVE_POINTS * 3);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
  const lineMat = new THREE.LineBasicMaterial({ color: '#F5F1E8', transparent: true, opacity: 0, depthWrite: false });
  const line = new THREE.Line(lineGeo, lineMat);
  line.frustumCulled = false;
  world.add(line);

  const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), new THREE.MeshBasicMaterial({
    color: C.accent, toneMapped: false, transparent: true, opacity: 0,
  }));
  pulse.visible = false;
  world.add(pulse);
  let pulseHalo = null;
  if (!mobile) {
    pulseHalo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: haloTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    pulseHalo.scale.setScalar(0.42);
    pulse.add(pulseHalo);
  }

  // Sections → steps
  const sections = Array.from(document.querySelectorAll('[data-scene]'))
    .sort((a, b) => Number(a.dataset.scene) - Number(b.dataset.scene));
  const count = Math.max(1, sections.length);
  const K = CONFIG.steps.length;
  const steps = Array.from({ length: count }, (_, i) =>
    CONFIG.steps[count === 1 ? 0 : Math.round((i * (K - 1)) / (count - 1))]);
  const storyAt = (i) => (count === 1 ? 0 : (i * STORY_MAX) / (count - 1));

  const state = {
    renderer, scene, envRT, phoneScreen, laptopScreen,
    reduced, mode: layoutMode(),
    timeline: null, observers: [], listeners: [],
    running: false, inView: true, firstFrame: false, disposed: false,
    clock: new THREE.Clock(), elapsed: 0,
    pixelRatio: 1, frameTimes: [],
    textures: [shadowTex, haloTex],
  };
  app = state;

  const target = flatStep(steps[0], state.mode, 0);
  const current = { ...target };
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  const on = (el, type, fn, opts) => { el.addEventListener(type, fn, opts); state.listeners.push([el, type, fn, opts]); };

  /* ----- sizing ----- */
  function pickPixelRatio() {
    const w = window.innerWidth, h = window.innerHeight;
    const maxPR = mobile ? CONFIG.mobile.maxPixelRatio : CONFIG.render.maxPixelRatio;
    const maxPixels = mobile ? CONFIG.mobile.maxPixels : CONFIG.render.maxPixels;
    return Math.min(window.devicePixelRatio || 1, maxPR, Math.sqrt(maxPixels / (w * h)));
  }

  function applySize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setPixelRatio(state.pixelRatio);
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.aspect = aspect;
    if (aspect < CONFIG.render.minAspect) {
      const tn = Math.tan(THREE.MathUtils.degToRad(CONFIG.render.fov / 2)) * (CONFIG.render.minAspect / aspect);
      camera.fov = Math.min(CONFIG.render.maxFov, THREE.MathUtils.radToDeg(Math.atan(tn)) * 2);
    } else {
      camera.fov = CONFIG.render.fov;
    }
    camera.updateProjectionMatrix();
  }

  let lastW = 0;
  function resize() {
    // Phones fire resize when the address bar shows/hides; only width changes
    // need a new layout.
    const widthChanged = window.innerWidth !== lastW;
    lastW = window.innerWidth;
    state.pixelRatio = pickPixelRatio();
    state.frameTimes.length = 0;
    applySize();
    if (widthChanged) {
      state.mode = layoutMode();
      buildTimeline();
    }
    if (!state.running) renderStill();
  }

  function applyFrame(fx, fy) {
    const w = window.innerWidth, h = window.innerHeight;
    camera.setViewOffset(w, h, -fx * w, -fy * h, w, h);
  }

  /* ----- scroll choreography ----- */
  function anchors() {
    const vh = window.innerHeight;
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - vh);
    const out = [];
    const wide = state.mode === 'wide';
    sections.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const edge = wide ? r.top - vh * CONFIG.layout.wideAnchor : r.bottom - vh * CONFIG.layout.stackedAnchor;
      let a = i === 0 ? 0 : Math.min(maxScroll, Math.max(0, edge + window.scrollY));
      if (i > 0 && a <= out[i - 1]) a = out[i - 1] + 1;
      out.push(a);
    });
    return out;
  }

  function buildTimeline() {
    const gsap = window.gsap, ST = window.ScrollTrigger;
    const keys = steps.map((st, i) => flatStep(st, state.mode, storyAt(i)));

    if (state.timeline) {
      if (state.timeline.scrollTrigger) state.timeline.scrollTrigger.kill();
      state.timeline.kill();
      state.timeline = null;
    }

    if (state.reduced) {
      // One static finale frame
      Object.assign(target, keys[keys.length - 1], { story: STORY_MAX });
      Object.assign(current, target);
      return;
    }
    if (!gsap || !ST || sections.length < 2) {
      Object.assign(target, keys[0]);
      return;
    }
    gsap.registerPlugin(ST);

    const a = anchors();
    const tl = gsap.timeline({
      scrollTrigger: { start: a[0], end: a[a.length - 1], scrub: CONFIG.motion.scrub },
    });
    for (let i = 0; i < keys.length - 1; i++) {
      const dur = a[i + 1] - a[i];
      const { story: s0, ...from } = keys[i];
      const { story: s1, ...to } = keys[i + 1];
      // Camera + devices: slow, film-like easing
      tl.fromTo(target, from, { ...to, duration: dur, ease: CONFIG.motion.ease, immediateRender: false }, a[i] - a[0]);
      // Story: linear, so every beat maps evenly onto scroll distance
      tl.fromTo(target, { story: s0 }, { story: s1, duration: dur, ease: 'none', immediateRender: false }, a[i] - a[0]);
    }
    state.timeline = tl;
    tl.scrollTrigger.refresh();
    tl.progress(tl.scrollTrigger.progress);
  }

  /* ----- visibility ----- */
  function updateRunning() {
    const run = !state.reduced && state.inView && document.visibilityState === 'visible' && !state.disposed;
    if (run === state.running) return;
    state.running = run;
    if (run) { state.clock.getDelta(); state.frameTimes.length = 0; renderer.setAnimationLoop(frame); }
    else renderer.setAnimationLoop(null);
  }

  if ('IntersectionObserver' in window) {
    const visible = new Set();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target)));
      state.inView = visible.size > 0;
      updateRunning();
    }, { rootMargin: '15% 0px 15% 0px' });
    sections.forEach((el) => io.observe(el));
    state.observers.push(io);
  }

  /* ----- mouse parallax (fine pointers only) ----- */
  if (!reduced && mqFinePointer.matches) {
    on(window, 'pointermove', (e) => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
    on(document.documentElement, 'mouseleave', () => { mouse.x = 0; mouse.y = 0; });
  }

  /* ----- per-frame update ----- */
  const look = new THREE.Vector3(), off = new THREE.Vector3(), sph = new THREE.Spherical();
  const pA = new THREE.Vector3(), pB = new THREE.Vector3();
  const I = CONFIG.intro, M = CONFIG.motion;

  function update(dt, t) {
    const still = state.reduced;

    // Ease current → target
    const k = still ? 1 : damp(M.follow, dt);
    const ks = still ? 1 : damp(M.storyFollow, dt);
    for (const key in target) current[key] = lerp(current[key], target[key], key === 'story' ? ks : k);

    // Mouse
    const km = damp(M.mouseLerp, dt);
    mouse.sx = lerp(mouse.sx, mouse.x, km);
    mouse.sy = lerp(mouse.sy, mouse.y, km);
    const maxRad = THREE.MathUtils.degToRad(M.mouseMaxDeg);

    // Intro (time based; skipped for reduced motion)
    const lidP = still ? 1 : easeOut3(clamp01(t / I.lidDuration));
    const phoneP = still ? 1 : easeOut3(clamp01((t - I.phoneDelay) / I.phoneDuration));
    const screensOn = still ? 1 : easeInOut(clamp01((t - I.screensOnAt) / I.screensOnFor));
    L.lid.rotation.x = lerp(Math.PI / 2, I.lidOpenAngle, lidP);

    // Devices
    laptopRig.position.set(current.lpx, current.lpy, current.lpz);
    laptopRig.rotation.set(current.lrx, current.lry, current.lrz);
    phoneRig.position.set(current.ppx, current.ppy - (1 - phoneP) * 0.55, current.ppz);
    phoneRig.rotation.set(current.prx, current.pry, current.prz);

    const lf = M.laptopFloat, pf = M.phoneFloat;
    if (!still) {
      laptopFloat.position.y = lf.amp + Math.sin(t * lf.speed) * lf.amp;
      laptopFloat.rotation.z = Math.sin(t * lf.speed * 0.8 + 0.5) * lf.tilt;
      laptopFloat.rotation.x = Math.sin(t * lf.speed * 0.6 + 1.2) * lf.tilt;
      phoneFloat.position.y = Math.sin(t * pf.speed + 1.7) * pf.amp;
      phoneFloat.rotation.z = Math.sin(t * pf.speed * 0.7 + 0.3) * pf.tilt;
      phoneFloat.rotation.y = Math.sin(t * pf.speed * 0.5 + 2.1) * pf.tilt;
    } else {
      laptopFloat.position.y = lf.amp;
    }
    laptopShadow.material.opacity = 0.95 - (laptopFloat.position.y / (lf.amp * 2)) * 0.25;
    phoneShadow.position.set(phoneRig.position.x, 0, phoneRig.position.z);
    phoneShadow.material.opacity = 0.5 * phoneP;

    world.rotation.set(mouse.sy * maxRad * 0.3, mouse.sx * maxRad * 0.5, 0);

    // Camera: keyframe orbit + a few degrees of mouse
    applyFrame(current.fx, current.fy);
    look.set(current.clx, current.cly, current.clz);
    off.set(current.cpx, current.cpy, current.cpz).sub(look);
    sph.setFromVector3(off);
    sph.theta += mouse.sx * maxRad;
    sph.phi = Math.min(Math.PI - 0.05, Math.max(0.05, sph.phi + mouse.sy * maxRad * 0.6));
    camera.position.setFromSpherical(sph).add(look);
    camera.lookAt(look);

    // Screens
    const glow = 0.94 * screensOn;
    phoneScreen.material.color.setScalar(glow);
    laptopScreen.material.color.setScalar(glow);
    L.spill.intensity = 1.1 * screensOn;
    const s = current.story;
    phoneScreen.update(s, t);
    laptopScreen.update(s, t);

    // Connection curve between the devices
    scene.updateMatrixWorld();
    P.anchor.getWorldPosition(pA);
    L.anchor.getWorldPosition(pB);
    world.worldToLocal(pA);
    world.worldToLocal(pB);
    const pts = curve.points;
    pts[0].copy(pA);
    pts[3].copy(pB);
    pts[1].copy(pA).lerp(pB, 0.33).y += 0.55;
    pts[2].copy(pA).lerp(pB, 0.66).y += 0.5;
    for (let i = 0; i < CURVE_POINTS; i++) {
      curve.getPoint(i / (CURVE_POINTS - 1), pB);
      linePos[i * 3] = pB.x; linePos[i * 3 + 1] = pB.y; linePos[i * 3 + 2] = pB.z;
    }
    lineGeo.attributes.position.needsUpdate = true;

    // Pulse along the curve, driven by story (so it reverses on scroll up)
    let pAlpha = 0;
    for (const p of CONFIG.pulses) {
      const raw = lin(s, p.window);
      if (raw > 0 && raw < 1) {
        const u = easeInOut(raw);
        curve.getPoint(p.to === 'laptop' ? u : 1 - u, pulse.position);
        pAlpha = bump(raw);
        break;
      }
    }
    pulse.visible = pAlpha > 0.01;
    pulse.material.opacity = pAlpha;
    if (pulseHalo) pulseHalo.material.opacity = 0.55 * pAlpha;
    lineMat.opacity = (0.1 + 0.2 * pAlpha) * screensOn;
  }

  function render() {
    renderer.render(scene, camera);
    if (!state.firstFrame) {
      state.firstFrame = true;
      root.classList.add('hero3d-ready');
      root.classList.remove('hero3d-fallback');
    }
  }

  // Drop resolution a step if frames are consistently slow.
  function adapt(rawDt) {
    const ft = state.frameTimes;
    ft.push(rawDt * 1000);
    if (ft.length < 90) return;
    const avg = ft.reduce((a, b) => a + b, 0) / ft.length;
    ft.length = 0;
    const minPR = mobile ? CONFIG.mobile.minPixelRatio : CONFIG.render.minPixelRatio;
    if (avg > CONFIG.render.slowFrameMs && state.pixelRatio > minPR) {
      state.pixelRatio = Math.max(minPR, state.pixelRatio - 0.2);
      applySize();
    }
  }

  function frame() {
    const raw = state.clock.getDelta();
    const dt = Math.min(raw, 1 / 20);
    state.elapsed += dt;
    update(dt, state.elapsed);
    render();
    adapt(raw);
  }

  function renderStill() {
    if (state.reduced) {
      update(0, 99);
      phoneScreen.update(STORY_MAX, 99, true);
      laptopScreen.update(STORY_MAX, 99, true);
    } else {
      update(0, state.elapsed);
    }
    render();
  }

  /* ----- wire up ----- */
  root.classList.add('hero3d-on');
  if (mobile) root.classList.add('hero3d-lite');

  resize();
  on(window, 'resize', debounce(resize, 160));
  on(document, 'visibilitychange', updateRunning);
  if (document.readyState !== 'complete') on(window, 'load', () => !state.disposed && buildTimeline());
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => !state.disposed && buildTimeline());

  renderStill();
  updateRunning();
}

/* -----------------------------------------------------------------------------
   Teardown on pagehide, rebuild if restored from the back/forward cache
   -------------------------------------------------------------------------- */
function destroy() {
  if (!app) return;
  const s = app;
  s.disposed = true;
  s.renderer.setAnimationLoop(null);
  s.listeners.forEach(([el, type, fn, opts]) => el.removeEventListener(type, fn, opts));
  s.observers.forEach((o) => o.disconnect());
  if (s.timeline) { if (s.timeline.scrollTrigger) s.timeline.scrollTrigger.kill(); s.timeline.kill(); }

  const seen = new Set();
  s.scene.traverse((obj) => {
    if (obj.geometry && !seen.has(obj.geometry)) { seen.add(obj.geometry); obj.geometry.dispose(); }
    const mats = obj.material ? (Array.isArray(obj.material) ? obj.material : [obj.material]) : [];
    mats.forEach((m) => {
      if (seen.has(m)) return;
      seen.add(m);
      if (m.map && !seen.has(m.map)) { seen.add(m.map); m.map.dispose(); }
      m.dispose();
    });
  });
  s.textures.forEach((tex) => tex.dispose());
  s.phoneScreen.dispose();
  s.laptopScreen.dispose();
  s.envRT.dispose();
  s.renderer.dispose();
  root.classList.remove('hero3d-ready');
  app = null;
}

window.addEventListener('pagehide', destroy);
window.addEventListener('pageshow', (e) => { if (e.persisted && !app) init(); });

init();
