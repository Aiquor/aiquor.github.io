/**
 * Three.js Hero Animation for Aiquor
 * - Transparent WebGL canvas behind hero
 * - Floating glass shape (Torus Knot on desktop, Icosahedron on mobile) with MeshPhysicalMaterial
 * - RoomEnvironment PMREM reflections & refractions
 * - ~1500 particles with dark green (#1f4d3f), off-white, and warm orange (#e8973a) accents
 * - Smooth lerped mouse parallax
 * - Respects prefers-reduced-motion (renders a static frame)
 * - Auto-pauses on document visibility hidden or hero offscreen
 * - Capped at devicePixelRatio 2, responsive and resize-safe
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

(function initHeroScene() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;

  const heroSection = canvas.closest('.hero');
  if (!heroSection) return;

  // Reduced motion detection
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let prefersReducedMotion = motionQuery.matches;

  // Scene & Renderer
  const scene = new THREE.Scene();

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
  } catch (err) {
    console.warn('WebGL initialization failed:', err);
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(heroSection.clientWidth, heroSection.clientHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  // Camera
  const camera = new THREE.PerspectiveCamera(
    42,
    heroSection.clientWidth / heroSection.clientHeight,
    0.1,
    100
  );
  camera.position.set(0, 0, 8.2);

  // RoomEnvironment for realistic glass refraction without heavy HDR downloads
  try {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const roomEnv = new RoomEnvironment();
    scene.environment = pmremGenerator.fromScene(roomEnv).texture;
    pmremGenerator.dispose();
  } catch (e) {
    console.warn('RoomEnvironment setup error:', e);
  }

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xf2f1ec, 0.85);
  scene.add(ambientLight);

  // Key light (soft warm white from top-right)
  const keyLight = new THREE.DirectionalLight(0xfff7ed, 2.5);
  keyLight.position.set(5, 6, 4);
  scene.add(keyLight);

  // Rim / back light with brand pine green tone (#1f4d3f)
  const rimLight = new THREE.DirectionalLight(0x1f4d3f, 3.4);
  rimLight.position.set(-6, -4, -3);
  scene.add(rimLight);

  // Warm orange point light accent (#e8973a)
  const orangePointLight = new THREE.PointLight(0xe8973a, 4.5, 20);
  orangePointLight.position.set(3.5, -2, 2.5);
  scene.add(orangePointLight);

  // Subtle deep green point light accent
  const greenPointLight = new THREE.PointLight(0x1f4d3f, 3.0, 20);
  greenPointLight.position.set(-3.5, 3, 2);
  scene.add(greenPointLight);

  // Glass Material
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xffffff),
    metalness: 0.03,
    roughness: 0.1,
    transmission: 0.96,
    ior: 1.48,
    thickness: 1.5,
    transparent: true,
    opacity: 1.0,
    iridescence: 0.32,
    iridescenceIOR: 1.33,
    iridescenceThicknessRange: [100, 400],
    specularIntensity: 1.0,
    specularColor: new THREE.Color(0xffffff),
    envMapIntensity: 1.3,
    clearcoat: 0.25,
    clearcoatRoughness: 0.1
  });

  // Geometry: Torus Knot on desktop, Icosahedron on mobile
  let isMobile = window.innerWidth < 768;
  let glassGeometry = isMobile
    ? new THREE.IcosahedronGeometry(1.35, 1)
    : new THREE.TorusKnotGeometry(1.4, 0.42, 120, 32, 2, 3);

  const glassMesh = new THREE.Mesh(glassGeometry, glassMaterial);
  scene.add(glassMesh);

  // Responsive position state
  const basePos = { x: 2.3, y: 0.05, z: 0, scale: 1.1 };
  function updateLayout() {
    const w = heroSection.clientWidth;
    const h = heroSection.clientHeight;
    isMobile = w < 768;

    if (isMobile) {
      basePos.x = 0;
      basePos.y = -0.4;
      basePos.scale = 0.85;
    } else if (w < 1024) {
      basePos.x = 1.5;
      basePos.y = 0;
      basePos.scale = 0.95;
    } else {
      // Desktop: positioned neatly on the right side behind/beside the white card
      basePos.x = 2.3;
      basePos.y = 0.05;
      basePos.scale = 1.1;
    }

    glassMesh.position.set(basePos.x, basePos.y, basePos.z);
    glassMesh.scale.setScalar(basePos.scale);
  }
  updateLayout();

  // Procedural soft circle particle texture
  function createParticleTexture() {
    const size = 64;
    const offCanvas = document.createElement('canvas');
    offCanvas.width = size;
    offCanvas.height = size;
    const ctx = offCanvas.getContext('2d');
    const grad = ctx.createRadialGradient(
      size / 2, size / 2, 0,
      size / 2, size / 2, size / 2
    );
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.25, 'rgba(255, 255, 255, 0.75)');
    grad.addColorStop(0.65, 'rgba(255, 255, 255, 0.12)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(offCanvas);
  }

  // Particles
  const particleCount = isMobile ? 450 : 1500;
  const particleGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const velocities = new Float32Array(particleCount);
  const driftOffsets = new Float32Array(particleCount);

  // Palette: pine green (#1f4d3f), muted sage, off-white, warm orange (#e8973a)
  const colorPine = new THREE.Color(0x1f4d3f);
  const colorSage = new THREE.Color(0x3a6b5a);
  const colorMuted = new THREE.Color(0x738078);
  const colorOrange = new THREE.Color(0xe8973a);

  for (let i = 0; i < particleCount; i++) {
    // Spread particles across the hero volume
    positions[i * 3]     = (Math.random() - 0.45) * 14;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 7;

    // Upward drift speed and phase
    velocities[i]   = 0.0015 + Math.random() * 0.0035;
    driftOffsets[i] = Math.random() * Math.PI * 2;

    // Color distribution: ~15% warm orange, remainder dark green and soft tones
    const rand = Math.random();
    let c;
    if (rand < 0.15) {
      c = colorOrange;
    } else if (rand < 0.55) {
      c = colorPine;
    } else if (rand < 0.8) {
      c = colorSage;
    } else {
      c = colorMuted;
    }

    colors[i * 3]     = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particleGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const particleMat = new THREE.PointsMaterial({
    size: isMobile ? 0.075 : 0.065,
    vertexColors: true,
    transparent: true,
    opacity: 0.65,
    map: createParticleTexture(),
    depthWrite: false,
    blending: THREE.NormalBlending
  });

  const particleMesh = new THREE.Points(particleGeo, particleMat);
  scene.add(particleMesh);

  // Mouse Parallax Interaction (smooth damped)
  let targetMouseX = 0;
  let targetMouseY = 0;
  let mouseX = 0;
  let mouseY = 0;

  function onMouseMove(e) {
    targetMouseX = (e.clientX / window.innerWidth) * 2 - 1;
    targetMouseY = -(e.clientY / window.innerHeight) * 2 + 1;
  }
  window.addEventListener('mousemove', onMouseMove, { passive: true });

  // Animation Loop State
  let isRunning = false;
  let animId = null;
  let clock = new THREE.Clock();

  function renderFrame() {
    renderer.render(scene, camera);
  }

  function animate() {
    if (!isRunning) return;

    const elapsedTime = clock.getElapsedTime();

    // Lerp mouse
    mouseX += (targetMouseX - mouseX) * 0.04;
    mouseY += (targetMouseY - mouseY) * 0.04;

    // Shape rotation and floating
    glassMesh.rotation.x = elapsedTime * 0.16 + mouseY * 0.25;
    glassMesh.rotation.y = elapsedTime * 0.22 + mouseX * 0.35;
    glassMesh.rotation.z = Math.sin(elapsedTime * 0.15) * 0.1;

    // Floating motion + parallax
    const floatOffset = Math.sin(elapsedTime * 0.75) * 0.14;
    glassMesh.position.x = basePos.x + mouseX * 0.45;
    glassMesh.position.y = basePos.y + floatOffset + mouseY * 0.35;

    // Particle parallax and slow drift
    particleMesh.position.x = mouseX * 0.25;
    particleMesh.position.y = mouseY * 0.2;

    const posArray = particleGeo.attributes.position.array;
    for (let i = 0; i < particleCount; i++) {
      // Slow upward drift
      posArray[i * 3 + 1] += velocities[i];
      // Subtle horizontal sway
      posArray[i * 3] += Math.sin(elapsedTime * 0.5 + driftOffsets[i]) * 0.0008;

      // Wrap around bounds
      if (posArray[i * 3 + 1] > 5) {
        posArray[i * 3 + 1] = -5;
      }
    }
    particleGeo.attributes.position.needsUpdate = true;

    // Camera micro-movement
    camera.position.x = mouseX * 0.2;
    camera.position.y = mouseY * 0.15;
    camera.lookAt(0, 0, 0);

    renderFrame();
    animId = requestAnimationFrame(animate);
  }

  function start() {
    if (isRunning || prefersReducedMotion) return;
    isRunning = true;
    clock.start();
    animId = requestAnimationFrame(animate);
  }

  function stop() {
    if (!isRunning) return;
    isRunning = false;
    clock.stop();
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
  }

  // Handle Tab Visibility (pause when tab is hidden)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stop();
    } else if (!prefersReducedMotion && isHeroInView) {
      start();
    }
  });

  // Pause when hero section is scrolled out of view
  let isHeroInView = true;
  if ('IntersectionObserver' in window) {
    const heroObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        isHeroInView = entry.isIntersecting;
        if (isHeroInView && !document.hidden && !prefersReducedMotion) {
          start();
        } else {
          stop();
        }
      });
    }, { threshold: 0.05 });
    heroObserver.observe(heroSection);
  }

  // Respect prefers-reduced-motion
  motionQuery.addEventListener('change', (e) => {
    prefersReducedMotion = e.matches;
    if (prefersReducedMotion) {
      stop();
      // Render clean static frame
      glassMesh.rotation.set(0.4, 0.6, 0.1);
      glassMesh.position.set(basePos.x, basePos.y, basePos.z);
      renderFrame();
    } else {
      start();
    }
  });

  // Resize-safe handler
  let resizeTimeout = null;
  function handleResize() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const w = heroSection.clientWidth;
      const h = heroSection.clientHeight;

      camera.aspect = w / h;
      camera.updateProjectionMatrix();

      renderer.setSize(w, h, false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

      updateLayout();

      if (prefersReducedMotion || !isRunning) {
        renderFrame();
      }
    }, 120);
  }
  window.addEventListener('resize', handleResize, { passive: true });

  // Initial display
  if (prefersReducedMotion) {
    glassMesh.rotation.set(0.4, 0.6, 0.1);
    glassMesh.position.set(basePos.x, basePos.y, basePos.z);
    renderFrame();
  } else {
    start();
  }
})();
