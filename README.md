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

The existing connected-workflow hero is preserved. FluidFieldBackground is an aria-hidden, pointer-transparent background behind the whole page, with reduced intensity, white text, solid black reading panels, and open gutters to reveal the animation.

## Service pages and site configuration

The homepage links to four dedicated service pages: AI agents, MCP integrations,
cybersecurity, and internal tools. Edit their shared template and content in
`scripts/generate-pages.mjs`; `npm run dev` and `npm run build` regenerate them.
The privacy page uses the same template. The homepage remains in `index.html`.
New layout refinements are in `styles/improvements.css`.

The background keeps its existing flowing pattern with lower brightness and
opacity. Case studies open only on click or keyboard activation, with horizontal
headings. Their illustrations are explicitly labeled, and precise time-saving
claims are withheld until measurement dates and methodology are supplied.
Real client screenshots, project dates, approved quotes, and remaining team
portraits/profile URLs should be added only from verified material.

Copy `.env.example` to `.env.local` for local configuration. Production uses the
same names as GitHub repository Actions variables:

- `VITE_SITE_URL`: the live HTTPS origin; defaults to `https://aiquor.github.io`.
- `VITE_CONTACT_EMAIL`: an existing, activated FormSubmit recipient; defaults to
  the working contact address. Updates page copy, mail links, structured data,
  and the form endpoint together.
- `VITE_GA_MEASUREMENT_ID`: a public GA4 Web-stream ID starting with `G-`.
  Blank keeps Google Analytics disabled.

The build emits a canonical URL per page, Open Graph/Twitter metadata, a 1200 ×
630 sharing image, Organization/Service structured data, robots.txt, and a
nine-page sitemap. `npm run check` verifies built links, local assets, anchors,
metadata, and sharing-image dimensions. CI runs this check before publishing.

### Domain and email setup

Production uses `https://getaiquor.com`, registered with Cloudflare on
October 5, 2026. The domain is verified for the Aiquor organization in GitHub
Pages. Keep its `_github-pages-challenge-aiquor` TXT record to retain verification.
The apex has GitHub Pages' four A and four AAAA records; `www` points directly
to `aiquor.github.io`. These records use DNS-only mode. GitHub Pages provides
the HTTPS certificate and redirects `www` to the apex.

`hello@getaiquor.com` receives mail through Cloudflare Email Routing and forwards
to the site owner's verified Gmail inbox. This is an incoming address, not a
separate mailbox or an outbound SMTP account. Cloudflare manages its MX, SPF,
and DKIM records. FormSubmit was activated for this address and origin, and a
synthetic enquiry was delivered to the destination inbox on October 5, 2026.

For any future domain change, configure the custom domain in GitHub Pages and its required
DNS records, following [GitHub's domain instructions](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).
Only after DNS and HTTPS are ready, set `VITE_SITE_URL` and rebuild. Custom-domain
builds also emit CNAME. Set up the mailbox with your email provider and configure
its MX and authentication records before changing `VITE_CONTACT_EMAIL`.
FormSubmit activation is needed again for a new recipient or form origin.

### Analytics setup

Follow [Google's setup guide](https://support.google.com/analytics/answer/9304153?hl=en):
create an Analytics account/property, add a Web data stream for the live site,
and copy its `G-…` measurement ID. Set `VITE_GA_MEASUREMENT_ID` as an Actions
variable and rebuild. The measurement ID is public; do not provide passwords
or API secrets. The privacy page reflects whether analytics is enabled.

Events in `js/analytics.js` are `booking_click`, `case_study_open`, and
`generate_lead`. A booking click records a click, not a completed appointment.
The lead event runs only after FormSubmit reports success. Custom event payloads
contain action types, placement/case identifiers, and page paths, never form
contents. Do Not Track and Global Privacy Control skip the analytics provider.
The local `aiquor:analytics` event remains available for verification.

### HealthTech Hub concept demo

The three-page concept is available at `/health-tech-hub/`: the home page,
searchable directory at `/health-tech-hub/explore/`, and reusable resource
detail page at `/health-tech-hub/resource/?id=clinical-ai`. Resource titles link
to their matching details; the directory filters and demo interest form are
interactive. The assistant uses prepared sample responses, and the form does not
send or store submissions. This is a frontend prototype with illustrative
content, not a connected health service or a clinical guidance tool.

### Verification completed October 5, 2026

Production compilation and the six-page build checks pass. DOM-based runtime
checks covered shared navigation, booking events, deliberate accordion selection,
and form success/failure/honeypot handling. The site was visually checked on
desktop and at a 390-pixel phone width. FormSubmit activation was completed for
the current live origin and contact address; a labeled test enquiry was verified
in the recipient's connected Gmail inbox. A local mobile Lighthouse 13.4.1 audit scored 97 for performance, 100 for
accessibility, 100 for best practices, and 100 for SEO (LCP 2.3s, TBT 10ms,
CLS 0). These are lab results for the local production preview, not field data.

## Publishing

The public site is https://aiquor.github.io/. Pushing to `main` runs `.github/workflows/pages.yml`: Node 24 installs locked dependencies, checks TypeScript, builds Vite, and deploys `dist/` to GitHub Pages. Pages must use GitHub Actions as its publishing source.
