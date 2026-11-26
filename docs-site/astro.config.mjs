// @ts-check
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

// Served under /docs next to the marketing site (../site). Links inside the content use /docs/... paths.
export default defineConfig({
	base: '/docs',
	trailingSlash: 'always',
	integrations: [
		starlight({
			title: 'Hagstone',
			description:
				'Documentation for Hagstone, the local-first application security scanner: install, scan, CI, baselines, coding agents and every rule.',
			logo: { dark: './src/assets/mark.svg', light: './src/assets/mark-light.svg' },
			favicon: '/favicon.svg',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/kx7m2qd/hagstone' }],
			editLink: { baseUrl: 'https://github.com/kx7m2qd/hagstone/edit/main/docs-site/' },
			lastUpdated: true,
			customCss: ['./src/styles/theme.css'],
			head: [
				{ tag: 'link', attrs: { rel: 'preconnect', href: 'https://fonts.googleapis.com' } },
				{ tag: 'link', attrs: { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' } },
				{
					tag: 'link',
					attrs: {
						rel: 'stylesheet',
						href: 'https://fonts.googleapis.com/css2?family=Geist:wght@300..700&family=Geist+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap',
					},
				},
			],
			sidebar: [
				{
					label: 'Getting started',
					items: [
						'getting-started/introduction',
						'getting-started/installation',
						'getting-started/first-scan',
						'getting-started/ci',
					],
				},
				{
					label: 'Guides',
					items: [
						'guides/github-action',
						'guides/existing-codebase',
						'guides/suppressing-findings',
						'guides/pre-commit-hook',
						'guides/coding-agents',
						'guides/dependencies',
						'guides/supply-chain',
						'guides/infrastructure-as-code',
						'guides/containers',
						'guides/sbom-and-licenses',
						'guides/ignoring-paths',
						'guides/offline',
					],
				},
				{
					label: 'Concepts',
					items: [
						'concepts/how-it-works',
						'concepts/what-leaves-your-machine',
						'concepts/severity-and-noise',
						'concepts/engines',
						'concepts/accuracy',
					],
				},
				{
					label: 'Reference',
					items: [
						'reference/cli',
						'reference/configuration',
						'reference/baseline-file',
						'reference/output-formats',
						{ label: 'Rule catalogue', link: '/reference/rules/' },
						'reference/engine-versions',
						'reference/help',
					],
				},
				{
					label: 'Help',
					items: ['help/troubleshooting', 'help/faq', 'help/security'],
				},
			],
		}),
	],
});
