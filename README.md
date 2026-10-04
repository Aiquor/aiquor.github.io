# aiquor

The existing landing page uses a React island for the orange fluid page background, with Vite, TypeScript, Tailwind CSS v4, and a shadcn-compatible project structure.

## Development and production

```sh
npm install
npm run dev
```

Open http://localhost:4173. The old Python static server cannot compile the React entry point.

```sh
npm run build
npm run preview
```

`npm run build` checks TypeScript and generates the deployable site in `dist/`. Serve that directory for production; do not deploy the source HTML directly.

## Components and styles

- Reusable React components: `/components/ui`.
- Active fluid background: `/components/ui/fluid-field.tsx`.
- Previous CubeWave helpers (available for reuse): `/components/ui/cube-wave-utils`.
- Full-screen fluid usage example: `/components/ui/fluid-field-demo.tsx`.
- Background mount and explicit props: `/src/background.tsx`.
- Deferred background loading: `/src/background-loader.ts` (after page load, during idle time).
- Tailwind entry: `/styles/globals.css`.
- Existing page layout and theme: `/style.css` and `/theme.css`.
- `@/` resolves to the project root in both TypeScript and Vite.

The `/components/ui` folder is important because the supplied component imports and shadcn CLI aliases resolve there. `components.json` configures this folder and the Tailwind stylesheet. Tailwind preflight is omitted to preserve the existing page styles.

The decorative 3D chunk loads separately after the page is ready; page controls stay in the small initial bundle. Tailwind scans only application sources, and the inline illustration uses a resized WebP while retaining its original PNG.

The setup is already implemented. For a fresh project, the equivalent steps are:

```sh
npm create vite@latest my-site -- --template react-ts
cd my-site
npm install
npm install tailwindcss @tailwindcss/vite
npx shadcn@latest init
npm install three @react-three/fiber clsx tailwind-merge lucide-react
npm install -D @types/three
```

Configure the Tailwind Vite plugin and `@/` alias as shown in this project's `vite.config.ts` and `tsconfig.json`. For this configured project, add shadcn components using:

```sh
npx shadcn@latest add button
```

## Fluid background integration

The supplied fluid shader is adapted into `/components/ui/fluid-field.tsx`, using the installed Three.js dependency and a native canvas instead of an iframe with remote scripts. Its simplex-noise motion is preserved with orange and amber glow colors. No new package, state provider, image, or icon is required.

The background is deferred until after page load, fills the viewport on desktop and mobile, caps pixel density at 1, and renders at up to 30 frames per second. It pauses in hidden tabs, respects reduced motion, releases GPU resources on unmount, handles WebGL context restoration, and uses an orange CSS gradient if WebGL is unavailable. The hue, saturation, brightness, mode, className, and style props remain available.

The page retains GSAP animations and the existing FormSubmit endpoint. Production email delivery requires the recipient's FormSubmit activation. Images and supporting assets live in `/assets`; the approved palette is recorded in `DESIGN.md`.

The existing connected-workflow hero is preserved. FluidFieldBackground is an aria-hidden, pointer-transparent background behind the whole page, at full opacity, with white text, solid black reading panels, and open gutters to reveal the animation.

## Publishing

The public site is https://aiquor.github.io/. Pushing to `main` runs `.github/workflows/pages.yml`: Node 24 installs locked dependencies, checks TypeScript, builds Vite, and deploys `dist/` to GitHub Pages. Pages must use GitHub Actions as its publishing source.
