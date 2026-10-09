import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  const siteUrl = (env.VITE_SITE_URL || 'https://aiquor.github.io').replace(/\/$/, '');
  const site = new URL(siteUrl);
  if (site.protocol !== 'https:' || site.pathname !== '/' || site.search || site.hash) {
    throw new Error('VITE_SITE_URL must be an HTTPS origin, such as https://getaiquor.com');
  }
  const contactEmail = env.VITE_CONTACT_EMAIL || 'imeanhashir88@gmail.com';
  if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(contactEmail)) {
    throw new Error('VITE_CONTACT_EMAIL must be a valid email address.');
  }
  const analyticsEnabled = /^G-[A-Z0-9]+$/.test(env.VITE_GA_MEASUREMENT_ID || '');
      const paths = ['/', '/services/ai-agents/', '/services/mcp-integrations/', '/services/cybersecurity/', '/services/internal-tools/', '/privacy/', '/health-tech-hub/', '/health-tech-hub/explore/', '/health-tech-hub/resource/', '/demo/support/'];
  return {
    plugins: [react(), tailwindcss(), {
      name: 'aiquor-public-metadata',
      transformIndexHtml(html) {
        return html.replaceAll('https://aiquor.github.io', siteUrl)
          .replaceAll('imeanhashir88@gmail.com', contactEmail)
          .replaceAll('__ANALYTICS_PRIVACY__', analyticsEnabled
            ? 'Google Analytics is enabled to measure page visits, discovery-call link clicks, and successful form submissions. Our custom events contain page paths and action types, not enquiry text or contact details. Analytics is skipped when your browser signals Do Not Track or Global Privacy Control.'
            : 'No analytics provider is enabled on this website. Booking clicks and successful form submissions are not currently sent to an analytics service.');
      },
      generateBundle() {
        for (const file of ['aiquor-og.png', 'favicon.svg']) {
          this.emitFile({ type: 'asset', fileName: `assets/social/${file}`, source: readFileSync(fileURLToPath(new URL(`assets/social/${file}`, import.meta.url))) });
        }
        this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n` });
        this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map(path => `  <url><loc>${siteUrl}${path}</loc></url>`).join('\n')}\n</urlset>\n` });
        if (site.hostname !== 'aiquor.github.io') this.emitFile({ type: 'asset', fileName: 'CNAME', source: `${site.hostname}\n` });
      },
    }],
    // Public metadata and form routing share one configurable domain and mailbox.
    // Keep the current working addresses until the new domain and mailbox exist.
    resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
    base: './',
    publicDir: 'public',
    build: {
      rollupOptions: {
        input: Object.fromEntries(paths.map((path, index) => [index === 0 ? 'home' : path.split('/').filter(Boolean).join('-'), fileURLToPath(new URL(`.${path}index.html`, import.meta.url))])),
      },
    },
  };
});
