import { Component, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Group, MathUtils, Mesh, OrthographicCamera, Vector2 } from 'three';

// The SVG stays the semantic, readable foreground even when WebGL fails.
class SceneFallback extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

function Orbit({ radius, tilt, phase, moving }: {
  radius: number; tilt: [number, number, number]; phase: number; moving: boolean;
}) {
  const group = useRef<Group>(null);
  const signal = useRef<Mesh>(null);
  const time = useRef(0);
  useFrame((_, delta) => {
    if (!moving || !group.current || !signal.current) return;
    time.current += Math.min(delta, 0.05);
    group.current.rotation.z = tilt[2] + Math.sin(time.current * 0.12 + phase) * 0.18;
    const angle = time.current * 0.32 + phase;
    signal.current.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
  });
  return (
    <group ref={group} rotation={tilt}>
      <mesh>
        <torusGeometry args={[radius, 0.006, 6, 128]} />
        <meshBasicMaterial color="#CC8066" transparent opacity={0.32} />
      </mesh>
      <mesh ref={signal} position={[Math.cos(phase) * radius, Math.sin(phase) * radius, 0]}>
        <sphereGeometry args={[0.025, 12, 8]} />
        <meshBasicMaterial color="#F4D5C5" />
      </mesh>
    </group>
  );
}

function Network({ pointer, moving }: { pointer: Vector2; moving: boolean }) {
  const group = useRef<Group>(null);
  const { camera, size, invalidate } = useThree();
  // Match the existing SVG's 600 × 480 coordinate space, including letterboxing.
  useLayoutEffect(() => {
    const orthographic = camera as OrthographicCamera;
    orthographic.zoom = Math.min(size.width / 6, size.height / 4.8);
    orthographic.updateProjectionMatrix();
    invalidate();
  }, [camera, size.width, size.height, invalidate]);
  useFrame((_, delta) => {
    if (!moving || !group.current) return;
    group.current.rotation.x = MathUtils.damp(group.current.rotation.x, pointer.y * 0.13, 3, delta);
    group.current.rotation.y = MathUtils.damp(group.current.rotation.y, pointer.x * 0.18, 3, delta);
  });
  return (
    <group ref={group}>
      <Orbit radius={1.32} tilt={[0.45, 0.15, 0.25]} phase={0.3} moving={moving} />
      <Orbit radius={1.55} tilt={[0.95, -0.35, -0.6]} phase={2.4} moving={moving} />
      <Orbit radius={1.76} tilt={[0.55, 0.7, 0.8]} phase={4.5} moving={moving} />
    </group>
  );
}

export default function WorkflowOrbit({ host }: { host: HTMLElement }) {
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [failed, setFailed] = useState(false);
  const pointer = useMemo(() => new Vector2(), []);
  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
    let intersecting = false;
    const updateVisibility = () => setVisible(intersecting && !document.hidden);
    const updateMotion = () => { setReduced(preference.matches); pointer.set(0, 0); };
    const observer = new IntersectionObserver(([entry]) => {
      intersecting = entry.isIntersecting;
      updateVisibility();
    });
    const move = (event: PointerEvent) => {
      if (preference.matches || !finePointer.matches) return;
      const bounds = host.getBoundingClientRect();
      pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1,
        (event.clientY - bounds.top) / bounds.height * 2 - 1);
    };
    const reset = () => pointer.set(0, 0);
    updateMotion();
    observer.observe(host);
    preference.addEventListener('change', updateMotion);
    document.addEventListener('visibilitychange', updateVisibility);
    host.addEventListener('pointermove', move);
    host.addEventListener('pointerleave', reset);
    return () => {
      observer.disconnect();
      preference.removeEventListener('change', updateMotion);
      document.removeEventListener('visibilitychange', updateVisibility);
      host.removeEventListener('pointermove', move);
      host.removeEventListener('pointerleave', reset);
    };
  }, [host, pointer]);
  if (failed) return null;
  const moving = visible && !reduced;
  return (
    <SceneFallback>
      <Canvas orthographic camera={{ position: [0, 0, 10], zoom: 100 }}
        dpr={[1, 1.5]} frameloop={moving ? 'always' : 'demand'}
        gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
        fallback={null}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          gl.domElement.addEventListener('webglcontextlost', () => setFailed(true), { once: true });
        }}>
        <Network pointer={pointer} moving={moving} />
      </Canvas>
    </SceneFallback>
  );
}
