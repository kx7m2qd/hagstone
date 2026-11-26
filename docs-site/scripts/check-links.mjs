// Fails if any internal link or #anchor in the built site (dist/) points nowhere.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
const pages = new Map(); // "/docs/x/" -> Set(ids)
const walk = (d) => readdirSync(d).forEach((f) => {
	const p = join(d, f);
	if (statSync(p).isDirectory()) return walk(p);
	if (!f.endsWith('.html')) return;
	const rel = '/docs/' + p.slice(dist.length + 1).replace(/index\.html$/, '').replace(/\.html$/, '/');
	const html = readFileSync(p, 'utf8');
	pages.set(rel.replace(/\/+$/, '/'), { html, ids: new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])) });
});
walk(dist);
const bad = [];
for (const [page, { html }] of pages) {
	for (const [, href] of html.matchAll(/href="([^"]+)"/g)) {
		if (!href.startsWith('/docs/') && !href.startsWith('#')) continue;
		if (/\.(css|js|svg|png|xml|ico|json)$/.test(href.split('#')[0])) continue;
		const [path, hash] = href.startsWith('#') ? [page, href.slice(1)] : href.split('#');
		const target = pages.get(path.endsWith('/') ? path : path + '/');
		if (!target) bad.push(`${page} → ${href} (no page)`);
		else if (hash && !target.ids.has(decodeURIComponent(hash))) bad.push(`${page} → ${href} (no anchor)`);
	}
}
if (bad.length) { console.error([...new Set(bad)].join('\n')); process.exit(1); }
console.log(`check-links: ${pages.size} pages, all internal links resolve`);
