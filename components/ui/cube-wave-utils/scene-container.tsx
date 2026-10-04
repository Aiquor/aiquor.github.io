"use client";

import * as React from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { cn } from '@/lib/utils';
import type { ThemeMode } from './use-shadcn-theme';

export type SceneContainerProps = {
  children: React.ReactNode;
  className?: string;
  theme?: ThemeMode;
  environment?: 'studio' | 'city' | 'sunset' | 'warehouse' | false;
  camera?: [number, number, number];
  fov?: number;
};

class SceneBoundary extends React.Component<{children: React.ReactNode}, {failed: boolean}> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <SceneFallback /> : this.props.children; }
}
function SceneFallback() {
  return <div className="cube-wave-fallback" role="img" aria-label="Cube wave illustration: terracotta and slate cubes"><span /><span /><span /><span /><span /></div>;
}

function FittedScene({children}: {children: React.ReactNode}) {
  const aspect = useThree(state => state.size.width / state.size.height);
  return <group scale={Math.min(0.52, 0.43 * aspect)}>{children}</group>;
}

export function SceneContainer({children, className, theme = 'auto', environment = 'studio', camera = [8, 7, 8], fov = 32}: SceneContainerProps) {
  const container = React.useRef<HTMLDivElement>(null);
  const [running, setRunning] = React.useState(true);
  React.useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let visible = true;
    const update = () => setRunning(visible && !document.hidden && !reduced.matches);
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); });
    if (container.current) observer.observe(container.current);
    reduced.addEventListener('change', update);
    document.addEventListener('visibilitychange', update);
    update();
    return () => { observer.disconnect(); reduced.removeEventListener('change', update); document.removeEventListener('visibilitychange', update); };
  }, []);
  const brightness = environment === 'warehouse' ? 0.8 : environment === 'city' ? 1.2 : 0.95;
  return (
    <div ref={container} data-cube-wave-theme={theme} className={cn('h-full w-full', theme === 'dark' && 'dark', className)}>
      <SceneBoundary>
        <Canvas camera={{position: camera, fov, near: 0.1, far: 100}} dpr={1} frameloop={running ? 'always' : 'demand'} gl={{alpha: true, antialias: true, toneMapping: THREE.NoToneMapping}} fallback={<SceneFallback />}>
          <ambientLight intensity={environment === false ? 1 : 0.9} />
          {environment !== false && <><directionalLight position={[4, 8, 5]} intensity={brightness} /><directionalLight position={[-5, 3, -4]} intensity={0.4} /></>}
          <FittedScene>{children}</FittedScene>
        </Canvas>
      </SceneBoundary>
    </div>
  );
}
