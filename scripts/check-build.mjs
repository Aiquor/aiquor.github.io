import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';

const root = resolve('dist');
function walk(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap(entry => {
    const fullPath = resolve(path, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}
const pages = walk(root).filter(file => file.endsWith('.html') && !file.includes('google6a0bdb688881b55e'));
assert.equal(pages.length, 9, 'Build must include the homepage, four services, privacy, and all three HealthTech Hub demo pages.');
for (const file of pages) {
  const html = readFileSync(file, 'utf8');
  assert.equal((html.match(/<h1\b/g) || []).length, 1, `${file}: one page heading required`);
  assert.ok(/rel="canonical"/.test(html), `${file}: canonical URL missing`);
  assert.ok(/property="og:image"/.test(html), `${file}: share image missing`);
  assert.ok(!html.includes('__ANALYTICS_PRIVACY__'), `${file}: unresolved privacy copy`);
  for (const [, content] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(content);
  for (const [, target] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (/^(?:https?:|mailto:|data:|#)/.test(target)) continue;
    const [pathAndQuery, fragment] = target.split('#');
    const path = pathAndQuery.split('?')[0];
    let destination = path.startsWith('/') ? resolve(root, `.${path}`) : resolve(dirname(file), path);
    if (path.endsWith('/')) destination = resolve(destination, 'index.html');
    assert.ok(existsSync(destination), `${relative(root, file)}: missing target ${target}`);
    if (fragment && destination.endsWith('.html')) {
      const destinationHtml = readFileSync(destination, 'utf8');
      assert.ok(destinationHtml.includes(`id="${fragment}"`), `${file}: missing anchor ${target}`);
    }
  }
  console.log(`PASS ${relative(root, file)}: local links, assets, anchors, metadata`);
}
const png = readFileSync(resolve(root, 'assets/social/aiquor-og.png'));
assert.equal(png.readUInt32BE(16), 1200);
assert.equal(png.readUInt32BE(20), 630);
assert.equal((readFileSync(resolve(root, 'sitemap.xml'), 'utf8').match(/<loc>/g) || []).length, 9);
console.log('PASS social-card dimensions and all nine sitemap entries');
