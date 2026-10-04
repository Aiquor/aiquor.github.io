"use client";

import * as React from 'react';
import * as THREE from 'three';
export type ThemeMode = 'auto' | 'light' | 'dark';

// Convert modern CSS colors (including shadcn oklch tokens) to sRGB.
function cssColor(value: string, fallback: string): THREE.Color {
  const color = value.trim();
  if (!color) return new THREE.Color(fallback);
  const normalized = /^\d/.test(color) ? `hsl(${color})` : color;
  const context = document.createElement('canvas').getContext('2d');
  if (!context || !CSS.supports('color', normalized)) return new THREE.Color(fallback);
  context.fillStyle = fallback;
  context.fillStyle = normalized;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  return new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
}

export function useShadcnTheme(theme: ThemeMode = 'auto') {
  const [colors, setColors] = React.useState(() => ({
    primaryColor: new THREE.Color('#CC8066'), accentColor: new THREE.Color('#334155'),
  }));
  React.useEffect(() => {
    const root = document.documentElement;
    const read = () => {
      const scoped = document.querySelector(`[data-cube-wave-theme="${theme}"]`) || root;
      const styles = getComputedStyle(scoped);
      setColors({
        primaryColor: cssColor(styles.getPropertyValue('--primary'), '#CC8066'),
        accentColor: cssColor(styles.getPropertyValue('--accent'), '#334155'),
      });
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
    const system = matchMedia('(prefers-color-scheme: dark)');
    system.addEventListener('change', read);
    return () => { observer.disconnect(); system.removeEventListener('change', read); };
  }, [theme]);
  return colors;
}
