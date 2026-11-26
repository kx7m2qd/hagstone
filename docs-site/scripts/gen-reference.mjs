// Generates the reference pages that must never drift from the code:
//   reference/rules/*        one page per rule in ../rules, examples taken from the rule's own test file
//   reference/help.md        the CLI's --help output, verbatim
//   reference/engine-versions.md   pinned engines from src/engines/manifest.ts
//   concepts/accuracy.md     benchmark numbers from bench/results/
// Runs before every `astro dev` / `astro build`. Output is gitignored.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const out = resolve(here, '../src/content/docs/reference');
const rulesOut = join(out, 'rules');

const LANGS = {
	javascript: { label: 'JavaScript / TypeScript', fence: { '.js': 'js', '.ts': 'ts', '.jsx': 'jsx', '.tsx': 'tsx' } },
	python: { label: 'Python', fence: { '.py': 'python' } },
	java: { label: 'Java', fence: { '.java': 'java' } },
};
const SEMGREP_SEVERITY = { ERROR: 'high', WARNING: 'medium', INFO: 'low' };
const SEV_ORDER = ['critical', 'high', 'medium', 'low', 'info'];

const yamlStr = (s) => JSON.stringify(String(s)); // JSON strings are valid YAML scalars
const firstSentence = (s) => (s.match(/^.*?[.!?](?=\s|$)/s)?.[0] ?? s).replace(/\s+/g, ' ').trim();
const cweId = (c) => c.match(/CWE-(\d+)/)?.[1];

/** Contiguous non-blank lines around each `ruleid:` / `ok:` annotation for this rule. */
function examples(testText, ruleId, kind) {
	const lines = testText.split('\n');
	const ann = new RegExp(`(?://|#)\\s*${kind}:\\s*([\\w,\\s-]+)$`);
	const anyAnn = /(?:\/\/|#)\s*(?:ruleid|ok|todoruleid|todook):/;
	const found = [];
	const used = new Set();
	lines.forEach((line, i) => {
		const m = line.match(ann);
		if (!m || !m[1].split(',').map((s) => s.trim()).includes(ruleId)) return;
		let a = i, b = i;
		while (a > 0 && lines[a - 1].trim() !== '') a--;
		while (b < lines.length - 1 && lines[b + 1].trim() !== '') b++;
		if (b - a > 16) { a = Math.max(a, i - 8); b = Math.min(b, i + 6); }
		const key = `${a}:${b}`;
		if (used.has(key)) return;
		used.add(key);
		const block = lines.slice(a, b + 1).filter((l) => !anyAnn.test(l));
		const indent = Math.min(...block.filter((l) => l.trim()).map((l) => l.match(/^\s*/)[0].length));
		found.push(block.map((l) => l.slice(indent)).join('\n').trimEnd());
	});
	return found.slice(0, 2);
}

function loadRules() {
	const all = [];
	for (const lang of Object.keys(LANGS)) {
		const dir = join(repo, 'rules', lang);
		const files = readdirSync(dir);
		for (const f of files.filter((f) => f.endsWith('.yml'))) {
			const base = basename(f, '.yml');
			const test = files.find((t) => t !== f && basename(t, extname(t)) === base);
			const testText = test ? readFileSync(join(dir, test), 'utf8') : '';
			const fence = test ? (LANGS[lang].fence[extname(test)] ?? '') : '';
			const doc = parse(readFileSync(join(dir, f), 'utf8'));
			for (const r of doc.rules ?? []) {
				const md = r.metadata ?? {};
				all.push({
					id: r.id,
					lang,
					languages: r.languages ?? [],
					title: md.title ?? r.id,
					message: String(r.message ?? '').replace(/\s+/g, ' ').trim(),
					severity: md.severity ?? SEMGREP_SEVERITY[r.severity] ?? 'medium',
					confidence: md.confidence ?? 'medium',
					cwe: md.cwe ?? [],
					owasp: md.owasp ?? [],
					bad: examples(testText, r.id, 'ruleid'),
					good: examples(testText, r.id, 'ok'),
					fence,
					source: `rules/${lang}/${f}`,
				});
			}
		}
	}
	return all.sort((a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity) || a.id.localeCompare(b.id));
}

const NICE_LANG = { javascript: 'JavaScript', typescript: 'TypeScript', python: 'Python', java: 'Java' };

function rulePage(r) {
	const cwe = r.cwe.map((c) => (cweId(c) ? `[${c}](https://cwe.mitre.org/data/definitions/${cweId(c)}.html)` : c));
	const block = (code) => `\`\`\`${r.fence}\n${code}\n\`\`\``;
	return `---
title: ${yamlStr(`${r.title} (${LANGS[r.lang].label.split(' /')[0]})`)}
description: ${yamlStr(firstSentence(r.message))}
editUrl: https://github.com/kx7m2qd/hagstone/edit/main/${r.source}
---

<div class="rule-meta">
<span><b>Rule</b> <code>${r.id}</code></span>
<span><b>Severity</b> <span class="sev ${r.severity}">${r.severity}</span></span>
<span><b>Confidence</b> ${r.confidence}</span>
<span><b>Languages</b> ${r.languages.map((l) => NICE_LANG[l] ?? l).join(', ')}</span>
</div>

## What it finds

${r.message}

## Classification

- **CWE:** ${cwe.join('; ') || 'none'}
- **OWASP Top 10:** ${r.owasp.join('; ') || 'none'}
${r.bad.length ? `\n## Flagged\n\nHagstone reports ${r.bad.length > 1 ? 'these' : 'this'}:\n\n${r.bad.map(block).join('\n\n')}\n` : ''}${r.good.length ? `\n## Not flagged\n\nThese ${r.good.length > 1 ? 'are' : 'is'} safe, and Hagstone leaves ${r.good.length > 1 ? 'them' : 'it'} alone:\n\n${r.good.map(block).join('\n\n')}\n` : ''}
## If this finding is wrong

If you've checked the code and it's safe, record that decision so the finding stops failing the build:

\`\`\`sh
hagstone suppress <finding id or path:line> --as false-positive --reason "why it is safe"
\`\`\`

See [Suppressing findings](/docs/guides/suppressing-findings/). A false positive or a missed case is a bug in the rule: please [open an issue](https://github.com/kx7m2qd/hagstone/issues) with a minimal example.

The rule's source and tests: [\`${r.source}\`](https://github.com/kx7m2qd/hagstone/blob/main/${r.source}).
`;
}

function catalogue(rules) {
	const by = Object.fromEntries(Object.keys(LANGS).map((l) => [l, rules.filter((r) => r.lang === l)]));
	const sections = Object.entries(by).map(([lang, rs]) => {
		const rows = rs
			.map((r) => `| [${r.title}](/docs/reference/rules/${r.id}/) <br/><code>${r.id}</code> | <span class="sev ${r.severity}">${r.severity}</span> | ${r.cwe.map((c) => c.split(':')[0]).join(', ')} | ${r.confidence} |`)
			.join('\n');
		return `## ${LANGS[lang].label}\n\n${rs.length} rules.\n\n| Rule | Severity | CWE | Confidence |\n|---|---|---|---|\n${rows}`;
	});
	return `---
title: Rule catalogue
description: Every code rule Hagstone ships, with its severity, CWE and confidence, generated from the rules themselves.
---

Hagstone ships **${rules.length} code rules** for JavaScript/TypeScript, Python and Java. Every rule is written by the Hagstone project, has tests with flagged and safe examples, and maps to a CWE and an OWASP Top 10 category. Each page below shows real examples taken from the rule's own test file.

This page is generated from [\`rules/\`](https://github.com/kx7m2qd/hagstone/tree/main/rules) on every docs build, so it always matches the release you are reading.

**Severity** is how bad the issue is if it's real. **Confidence** is how sure the rule is that a match is real: \`high\` rules follow untrusted data from where it enters to where it's used; \`medium\` and \`low\` rules match a risky pattern and can need a human look. See [Severity and noise](/docs/concepts/severity-and-noise/).

Dependency, secret, supply-chain, infrastructure and license checks come from their engines and are described in the [guides](/docs/guides/dependencies/).

${sections.join('\n\n')}
`;
}

function helpPage() {
	const tsx = join(repo, 'node_modules', '.bin', 'tsx');
	const text = execFileSync(tsx, ['src/cli.ts', '--help'], { cwd: repo, encoding: 'utf8' });
	return `---
title: --help output
description: The full output of hagstone --help for this version, generated from the CLI itself.
---

This is the exact output of \`hagstone --help\`, generated from the CLI when these docs were built. The [CLI reference](/docs/reference/cli/) explains each command in more detail.

\`\`\`text
${text.trimEnd()}
\`\`\`
`;
}

const ENGINE_INFO = {
	opengrep: ['Code (SAST)', 'LGPL-2.1', 'https://github.com/opengrep/opengrep'],
	'osv-scanner': ['Dependency vulnerabilities', 'Apache-2.0', 'https://github.com/google/osv-scanner'],
	gitleaks: ['Secrets', 'MIT', 'https://github.com/gitleaks/gitleaks'],
	trivy: ['Infrastructure as code', 'Apache-2.0', 'https://github.com/aquasecurity/trivy'],
	syft: ['Licenses, SBOM, image catalogue', 'Apache-2.0', 'https://github.com/anchore/syft'],
	grype: ['Container image vulnerabilities', 'Apache-2.0', 'https://github.com/anchore/grype'],
};
const VERIFY = {
	'sigstore-blob': 'Sigstore signature on the binary',
	'sigstore-checksums': 'Sigstore signature on the checksums file',
	slsa: 'SLSA build provenance',
	unsigned: 'Upstream checksums file (no signature published)',
};

function enginesPage() {
	const src = readFileSync(join(repo, 'src/engines/manifest.ts'), 'utf8');
	const rows = [];
	const re = /^ {2}"?([a-z-]+)"?: \{\n {4}version: "([^"]+)"/gm;
	for (const m of src.matchAll(re)) {
		const after = src.slice(m.index, m.index + 600);
		const kind = after.match(/kind: "([a-z-]+)"/)?.[1];
		const [what, license, url] = ENGINE_INFO[m[1]] ?? ['', '', ''];
		rows.push(`| [${m[1]}](${url}) | ${m[2]} | ${what} | ${license} | ${VERIFY[kind] ?? kind ?? ''} |`);
	}
	if (!rows.length) throw new Error('gen-reference: no engines parsed from manifest.ts');
	return `---
title: Engine versions
description: The exact engine versions this release of Hagstone pins, and how each one is verified.
---

Generated from [\`src/engines/manifest.ts\`](https://github.com/kx7m2qd/hagstone/blob/main/src/engines/manifest.ts) when these docs were built. Every binary is pinned by version **and** SHA-256 for Linux x64 and macOS arm64, and checked on every run. See [Engines and verification](/docs/concepts/engines/).

| Engine | Version | Used for | License | Verified in CI against |
|---|---|---|---|---|
${rows.join('\n')}

Supply-chain checks (\`pkgrisk\`) are written in TypeScript inside Hagstone, so there is no binary to pin.
`;
}

const OWASP_NAMES = {
	cmdi: 'Command injection', codeinj: 'Code injection', crypto: 'Weak encryption', deserialization: 'Insecure deserialization',
	hash: 'Weak hashing', ldapi: 'LDAP injection', pathtraver: 'Path traversal', redirect: 'Open redirect',
	securecookie: 'Insecure cookie', sqli: 'SQL injection', trustbound: 'Trust boundary violation', weakrand: 'Weak randomness',
	xpathi: 'XPath injection', xss: 'Cross-site scripting', xxe: 'XML external entities',
};
const pct = (x) => `${Math.round(x * 100)}%`;

function owaspTable(res) {
	const rows = Object.entries(res.categories)
		.filter(([, c]) => c.covered)
		.map(([k, c]) => `| ${OWASP_NAMES[k] ?? k} | ${c.cwe} | ${pct(c.tpr)} | ${pct(c.fpr)} | **${c.score.toFixed(2)}** | ${res.thresholds[k] != null ? res.thresholds[k].toFixed(2) : ''} |`);
	return `| Category | CWE | Found (TPR) | False alarms (FPR) | Score | CI gate |\n|---|---|---|---|---|---|\n${rows.join('\n')}`;
}

function accuracyPage() {
	const r = (f) => JSON.parse(readFileSync(join(repo, 'bench/results', f), 'utf8'));
	const own = r('latest.json'), py = r('owasp-python.json'), java = r('owasp-java.json'), cves = r('cves.json');
	const t = own.totals;
	const short = (s) => s.commit.slice(0, 7);
	return `---
title: Accuracy and benchmarks
description: How Hagstone measures precision and recall, and the current numbers, generated from the benchmark results in the repository.
---

A scanner is only useful if you can trust both what it reports and what it doesn't. Hagstone measures this on every change: CI fails if any number drops below its gate. The numbers on this page are generated from [\`bench/results/\`](https://github.com/kx7m2qd/hagstone/tree/main/bench/results) when these docs are built.

## Hagstone's own benchmark

Realistic small applications (an Express API, a Flask app, a Spring app, an LLM agent) plus infrastructure, license, supply-chain and reachability cases. Every real vulnerability is labelled in the source, and safe look-alikes sit next to them, so false positives count.

| | |
|---|---|
| Labelled vulnerabilities | ${t.labels} |
| Found | ${t.tp} |
| Missed | ${t.fn} |
| False positives | ${t.fp} |
| **Precision** | **${own.precision.toFixed(3)}** (gate ${own.thresholds.precision}) |
| **Recall** | **${own.recall.toFixed(3)}** (gate ${own.thresholds.recall}) |

Run it yourself: \`npm run bench\`.

## Real-world vulnerabilities

${cves.total} published advisories (GHSA) in real open-source projects, reduced to the vulnerable code. Hagstone must find the vulnerable version **and** stay quiet on the fixed one.

| | |
|---|---|
| Detected | ${cves.detected} of ${cves.total} (recall ${cves.recall.toFixed(2)}, gate ${cves.thresholds.recall}) |
| Fixed versions still flagged | ${cves.fixStillFlagged} |

## OWASP Benchmark

The [OWASP Benchmark](https://owasp.org/www-project-benchmark/) is thousands of small test cases, about half really vulnerable and half safe look-alikes. Its score is **true positive rate minus false positive rate**: 1.0 is perfect, 0 is no better than guessing. It's deliberately hard and synthetic, so read it as a comparison between tools, not as the rate you'll see on your code.

### Java

[BenchmarkJava](https://github.com/OWASP-Benchmark/BenchmarkJava) at \`${short(java.suite)}\`, scanned with cross-file taint.

${owaspTable(java)}

### Python

[BenchmarkPython](https://github.com/OWASP-Benchmark/BenchmarkPython) at \`${short(py.suite)}\`.

${owaspTable(py)}

Run them yourself: \`npm run bench:owasp:java\` and \`npm run bench:owasp\`. The suites are downloaded at a pinned commit and checked by SHA-256.

## Rules for the benchmarks

- Hagstone never special-cases a benchmark: no rule mentions a benchmark's helper functions or file names.
- A rule change that raises one score and lowers another doesn't ship until both hold their gates.
- Missed cases and false positives are listed in the result files, not hidden.

Found a false positive or a miss in your own code? [Open an issue](https://github.com/kx7m2qd/hagstone/issues) with a minimal example: it becomes a benchmark case.
`;
}

rmSync(rulesOut, { recursive: true, force: true });
mkdirSync(rulesOut, { recursive: true });
const rules = loadRules();
for (const r of rules) writeFileSync(join(rulesOut, `${r.id}.md`), rulePage(r));
writeFileSync(join(rulesOut, 'index.md'), catalogue(rules));
writeFileSync(join(out, 'help.md'), helpPage());
writeFileSync(join(out, 'engine-versions.md'), enginesPage());
writeFileSync(resolve(out, '../concepts/accuracy.md'), accuracyPage());
const noExamples = rules.filter((r) => !r.bad.length).map((r) => r.id);
console.log(`gen-reference: ${rules.length} rules, help, engine versions, accuracy${noExamples.length ? ` (no flagged examples: ${noExamples.join(', ')})` : ''}`);
