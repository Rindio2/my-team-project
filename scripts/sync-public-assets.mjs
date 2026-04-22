import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const publicDir = resolve(projectRoot, 'public');
const wellKnownDir = resolve(publicDir, '.well-known');

function normalizeUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return 'https://packet-opt-control-tower.pages.dev';
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

const appUrl = normalizeUrl(process.env.VITE_PUBLIC_APP_URL);
const securityContact = String(process.env.PUBLIC_SECURITY_CONTACT || 'mailto:security@packet-opt.example').trim();

mkdirSync(publicDir, { recursive: true });
mkdirSync(wellKnownDir, { recursive: true });

writeFileSync(
  resolve(publicDir, 'robots.txt'),
  `User-agent: *\nAllow: /\nSitemap: ${appUrl}/sitemap.xml\n`,
  'utf8'
);

writeFileSync(
  resolve(publicDir, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${appUrl}/</loc>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>\n</urlset>\n`,
  'utf8'
);

writeFileSync(
  resolve(wellKnownDir, 'security.txt'),
  `Contact: ${securityContact}\nExpires: 2027-12-31T23:59:59.000Z\nPreferred-Languages: vi, en\nCanonical: ${appUrl}/.well-known/security.txt\n`,
  'utf8'
);
