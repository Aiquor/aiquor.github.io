"use client";

import { useEffect, useRef, type CSSProperties } from 'react';

export type FluidFieldBackgroundProps = {
  mode?: 'dark' | 'light';
  hue?: number;
  saturation?: number;
  brightness?: number;
  className?: string;
  style?: CSSProperties;
};

// Raw WebGL 2D Simplex Noise fluid shader, eliminating ~740KB Three.js dependency.
const vertexShaderSource = `
  attribute vec2 position;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const fragmentShaderSource = `
  precision highp float;
  uniform float u_time;
  uniform vec2 u_resolution;

  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m;
    m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    uv.x *= u_resolution.x / u_resolution.y;

    vec3 baseColor = vec3(0.035, 0.012, 0.004);
    vec2 st = uv * 0.7;
    st += vec2(snoise(st + u_time * 0.05), snoise(st - u_time * 0.05)) * 0.3;

    float beam = smoothstep(0.1, 0.8, snoise(vec2(st.x + st.y * 1.5 - u_time * 0.15, u_time * 0.02)));
    vec3 glow = mix(vec3(1.0, 0.22, 0.015), vec3(1.0, 0.55, 0.08), snoise(uv * 1.5 + u_time * 0.1) * 0.5 + 0.5);

    gl_FragColor = vec4(baseColor + (glow * beam * 0.95), 1.0);
  }
`;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function FluidFieldBackground({
  mode = 'dark',
  hue = 0,
  saturation = 1,
  brightness = 1,
  className,
  style
}: FluidFieldBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false });
    if (!gl) return; // Fallback to CSS gradient

    function createShader(glCtx: WebGLRenderingContext, type: number, source: string) {
      const shader = glCtx.createShader(type);
      if (!shader) return null;
      glCtx.shaderSource(shader, source);
      glCtx.compileShader(shader);
      if (!glCtx.getShaderParameter(shader, glCtx.COMPILE_STATUS)) {
        glCtx.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vert = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const frag = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    if (!vert || !frag) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return;
    }

    gl.useProgram(program);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1.0, -1.0,
         1.0, -1.0,
        -1.0,  1.0,
        -1.0,  1.0,
         1.0, -1.0,
         1.0,  1.0,
      ]),
      gl.STATIC_DRAW
    );

    const posLocation = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(posLocation);
    gl.vertexAttribPointer(posLocation, 2, gl.FLOAT, false, 0, 0);

    const uTimeLoc = gl.getUniformLocation(program, 'u_time');
    const uResLoc = gl.getUniformLocation(program, 'u_resolution');

    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let elapsed = 0;
    let previous = 0;
    let lastRender = 0;
    let lost = false;

    const draw = () => {
      if (lost) return;
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    const resize = () => {
      if (lost) return;
      const { width, height } = canvas.getBoundingClientRect();
      const displayWidth = Math.max(1, Math.floor(width));
      const displayHeight = Math.max(1, Math.floor(height));
      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
      }
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform2f(uResLoc, gl.drawingBufferWidth, gl.drawingBufferHeight);
      draw();
    };

    const animate = (now: number) => {
      if (previous) elapsed += (now - previous) / 1000;
      previous = now;
      if (now - lastRender >= 1000 / 30) {
        gl.uniform1f(uTimeLoc, elapsed);
        draw();
        lastRender = now;
      }
      frame = requestAnimationFrame(animate);
    };

    const update = () => {
      cancelAnimationFrame(frame);
      previous = 0;
      if (lost) return;
      if (!document.hidden && !reduced.matches) {
        frame = requestAnimationFrame(animate);
      } else if (!document.hidden) {
        draw();
      }
    };

    const contextLost = (event: Event) => {
      event.preventDefault();
      lost = true;
      cancelAnimationFrame(frame);
    };

    const contextRestored = () => {
      lost = false;
      resize();
      update();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    document.addEventListener('visibilitychange', update);
    reduced.addEventListener('change', update);
    canvas.addEventListener('webglcontextlost', contextLost);
    canvas.addEventListener('webglcontextrestored', contextRestored);

    resize();
    update();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', update);
      reduced.removeEventListener('change', update);
      canvas.removeEventListener('webglcontextlost', contextLost);
      canvas.removeEventListener('webglcontextrestored', contextRestored);

      gl.deleteBuffer(positionBuffer);
      gl.deleteProgram(program);
      gl.deleteShader(vert);
      gl.deleteShader(frag);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      data-mode={mode}
      aria-hidden="true"
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        filter: `hue-rotate(${clamp(hue, -180, 180)}deg) saturate(${clamp(saturation, 0, 2)}) brightness(${clamp(brightness, 0.35, 1.65)})`,
        ...style,
      }}
    />
  );
}
