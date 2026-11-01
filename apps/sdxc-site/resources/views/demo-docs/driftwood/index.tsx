/**
 * The content docs demo: Driftwood, an invented command line that deploys static sites to
 * the edge, documented as a tutorial, how-to guides and concept pages. Set in a warm,
 * editorial register: stone neutrals, a terracotta accent, serif headings over a sans body.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DemoDocsSite } from "~/resources/views/demo-docs";

import { demoDocsHref } from "~/resources/views/demo-docs";
import { CACHING, HOW_DEPLOYS_WORK } from "~/resources/views/demo-docs/driftwood/concepts";
import {
	CUSTOM_DOMAINS,
	ENVIRONMENT_VARIABLES,
	PREVIEW_DEPLOYMENTS,
} from "~/resources/views/demo-docs/driftwood/guides";
import { PROJECT_LAYOUT, QUICKSTART } from "~/resources/views/demo-docs/driftwood/start";

/** The addresses of Driftwood's pages. */
const href = demoDocsHref("driftwood");

/** A terracotta ramp at hue 40, warm enough to read as clay rather than red. */
const BRAND = [
	"oklch(0.982 0.012 40)",
	"oklch(0.948 0.03 40)",
	"oklch(0.89 0.062 40)",
	"oklch(0.8 0.1 40)",
	"oklch(0.7 0.135 40)",
	"oklch(0.61 0.15 40)",
	"oklch(0.53 0.14 40)",
	"oklch(0.45 0.12 40)",
	"oklch(0.36 0.095 40)",
	"oklch(0.27 0.07 40)",
	"oklch(0.19 0.05 40)",
] as const;

/** Stone neutrals tinted toward the accent, so the page reads as warm paper in light and dark. */
const NEUTRAL = [
	"oklch(0.985 0.004 70)",
	"oklch(0.962 0.006 70)",
	"oklch(0.915 0.009 70)",
	"oklch(0.83 0.012 70)",
	"oklch(0.72 0.014 70)",
	"oklch(0.6 0.015 70)",
	"oklch(0.5 0.015 70)",
	"oklch(0.41 0.013 70)",
	"oklch(0.31 0.011 70)",
	"oklch(0.22 0.009 70)",
	"oklch(0.16 0.007 70)",
] as const;

/** A book serif for headings, the reader's own where none of the named faces is installed. */
const SERIF = "'Iowan Old Style', 'Palatino Linotype', Palatino, Charter, Georgia, serif";

/** Soft corners and a humanist sans body under serif headings. */
const TOKENS = {
	"--ui-font-sans": "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
	"--demo-docs-heading-font": SERIF,
	"--demo-docs-heading-weight": "600",
	"--ui-radius-md": "0.5rem",
	"--ui-radius-lg": "0.75rem",
} as const;

/** The Driftwood mark: a weathered plank over a wave. */
function mark() {
	return (
		<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
			<rect x="2" y="5" width="20" height="6" rx="3" fill="var(--ui-color-brand-600)" />
			<path
				d="M3 17c2.2-1.6 4.4-1.6 6.6 0s4.4 1.6 6.6 0 3.6-1.3 4.8-.6"
				fill="none"
				stroke="var(--ui-color-brand-500)"
				stroke-width="2"
				stroke-linecap="round"
			/>
		</svg>
	);
}

export default {
	name: "Driftwood",
	kind: "Content docs",
	tagline: "Guides for a static-site deploy CLI.",
	artDirection: "Stone, terracotta and serif headings.",
	description:
		"Guides for Driftwood, a command line that deploys static sites: a tutorial, how-to guides and concept pages.",
	mark,
	theme: { brand: BRAND, neutral: NEUTRAL, tokens: TOKENS },
	tree: {
		label: "Driftwood docs",
		sections: [
			{
				title: "Get started",
				items: [
					{ title: "Deploy your first site", href: href("start/quickstart") },
					{ title: "Project layout", href: href("start/project-layout") },
				],
			},
			{
				title: "Guides",
				items: [
					{ title: "Add a custom domain", href: href("guides/custom-domains") },
					{
						title: "Preview every pull request",
						href: href("guides/preview-deployments"),
						badge: "New",
					},
					{ title: "Use environment variables", href: href("guides/environment-variables") },
				],
			},
			{
				title: "Concepts",
				items: [
					{ title: "How a deploy works", href: href("concepts/how-deploys-work") },
					{ title: "Caching and invalidation", href: href("concepts/caching") },
				],
			},
		],
	},
	hub: {
		eyebrow: "Documentation",
		title: "Ship a static site in one command",
		lead: "Driftwood builds your site, uploads what changed and switches traffic to it at once. Start with the tutorial, or jump to the task in front of you.",
		start: [
			{
				eyebrow: "Tutorial · 5 min",
				title: "Deploy your first site",
				description: "Install the CLI, log in and put a site on a public URL.",
				href: href("start/quickstart"),
				cta: "Start the tutorial",
			},
			{
				eyebrow: "How-to",
				title: "Add a custom domain",
				description: "Point your domain at Driftwood and get a certificate issued for it.",
				href: href("guides/custom-domains"),
				cta: "Read the guide",
			},
			{
				eyebrow: "Concept",
				title: "How a deploy works",
				description: "What happens between running a deploy and its first visitor.",
				href: href("concepts/how-deploys-work"),
				cta: "Read the explainer",
			},
		],
		topics: [
			{ title: "Custom domains", href: href("guides/custom-domains") },
			{ title: "Pull request previews", href: href("guides/preview-deployments") },
			{ title: "Environment variables", href: href("guides/environment-variables") },
			{ title: "Cache headers", href: `${href("concepts/caching")}#headers` },
		],
		sections: [
			{
				title: "Get started",
				href: href("start/quickstart"),
				description: "The tutorial, and how a Driftwood project is laid out.",
				count: 2,
			},
			{
				title: "Guides",
				href: href("guides/custom-domains"),
				description: "Domains, previews and secrets, one task per page.",
				count: 3,
			},
			{
				title: "Concepts",
				href: href("concepts/how-deploys-work"),
				description: "How deploys and the cache behave, for when you need the why.",
				count: 2,
			},
		],
	},
	pages: {
		"start/quickstart": QUICKSTART,
		"start/project-layout": PROJECT_LAYOUT,
		"guides/custom-domains": CUSTOM_DOMAINS,
		"guides/preview-deployments": PREVIEW_DEPLOYMENTS,
		"guides/environment-variables": ENVIRONMENT_VARIABLES,
		"concepts/how-deploys-work": HOW_DEPLOYS_WORK,
		"concepts/caching": CACHING,
	},
} satisfies DemoDocsSite;
