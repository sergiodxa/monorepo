/**
 * The utilities docs demo: Tempo, an invented library of CSS utilities, documented as two
 * getting-started pages and a reference whose every utility is drawn doing what it does. Set
 * in a technical register: cool neutrals, a teal-green accent, mono headings and square corners.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DemoDocsSite } from "~/resources/views/demo-docs";

import { demoDocsHref } from "~/resources/views/demo-docs";
import {
	COLOR,
	EFFECTS,
	LAYOUT,
	SPACING,
	TYPOGRAPHY,
} from "~/resources/views/demo-docs/tempo/reference";
import { INSTALLATION, SCALES } from "~/resources/views/demo-docs/tempo/start";

/** The addresses of Tempo's pages. */
const href = demoDocsHref("tempo");

/** A teal-green ramp at hue 175, bright enough to read as a terminal cursor in dark mode. */
const BRAND = [
	"oklch(0.984 0.014 175)",
	"oklch(0.952 0.036 175)",
	"oklch(0.9 0.072 175)",
	"oklch(0.83 0.11 175)",
	"oklch(0.75 0.13 175)",
	"oklch(0.65 0.125 175)",
	"oklch(0.55 0.105 175)",
	"oklch(0.46 0.088 175)",
	"oklch(0.37 0.07 175)",
	"oklch(0.28 0.052 175)",
	"oklch(0.2 0.036 175)",
] as const;

/** Cool neutrals leaning blue, so code panels and the page read as one cold surface. */
const NEUTRAL = [
	"oklch(0.985 0.003 240)",
	"oklch(0.962 0.005 240)",
	"oklch(0.915 0.008 240)",
	"oklch(0.83 0.012 240)",
	"oklch(0.71 0.016 240)",
	"oklch(0.59 0.018 240)",
	"oklch(0.49 0.018 240)",
	"oklch(0.4 0.017 240)",
	"oklch(0.3 0.015 240)",
	"oklch(0.21 0.012 240)",
	"oklch(0.15 0.01 240)",
] as const;

/** The mono stack the headings and code share. */
const MONO = "'JetBrains Mono', 'SF Mono', ui-monospace, Menlo, Consolas, monospace";

/** Mono headings over a sans body, and near-square corners. */
const TOKENS = {
	"--ui-font-sans": "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
	"--ui-font-mono": MONO,
	"--demo-docs-heading-font": MONO,
	"--demo-docs-heading-weight": "600",
	"--ui-radius-md": "0.125rem",
	"--ui-radius-lg": "0.25rem",
} as const;

/** The Tempo mark: a two-by-two grid of tiles in two shades, a scale in miniature. */
function mark() {
	return (
		<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
			<rect x="2" y="2" width="9" height="9" rx="1.5" fill="var(--ui-color-brand-600)" />
			<rect x="13" y="2" width="9" height="9" rx="1.5" fill="var(--ui-color-brand-300)" />
			<rect x="2" y="13" width="9" height="9" rx="1.5" fill="var(--ui-color-brand-300)" />
			<rect x="13" y="13" width="9" height="9" rx="1.5" fill="var(--ui-color-brand-600)" />
		</svg>
	);
}

export default {
	name: "Tempo",
	kind: "Utilities docs",
	tagline: "Reference for a CSS utility library.",
	artDirection: "Cool neutrals, teal and mono headings.",
	description:
		"Reference for Tempo, an invented library of CSS utilities: every spacing, colour, layout, type and effect utility drawn beside its call and the CSS it emits.",
	mark,
	theme: { brand: BRAND, neutral: NEUTRAL, tokens: TOKENS },
	tree: {
		label: "Tempo docs",
		sections: [
			{
				title: "Get started",
				items: [
					{ title: "Installation", href: href("start/installation") },
					{ title: "Scales and tokens", href: href("start/scales") },
				],
			},
			{
				title: "Utilities",
				items: [
					{ title: "Spacing", href: href("utilities/spacing") },
					{ title: "Colour", href: href("utilities/colour") },
					{ title: "Layout", href: href("utilities/layout") },
					{ title: "Typography", href: href("utilities/typography") },
					{ title: "Effects", href: href("utilities/effects") },
				],
			},
		],
	},
	hub: {
		eyebrow: "@tempo/css",
		title: "Style in step",
		lead: "Small functions that each set one CSS declaration from a shared scale. Every utility is drawn on its page, beside the call and the CSS it emits.",
		start: [
			{
				eyebrow: "Get started",
				title: "Installation",
				description: "Install the package, load the tokens and build a first card.",
				href: href("start/installation"),
				cta: "Install Tempo",
			},
			{
				eyebrow: "Utilities",
				title: "Spacing",
				description: "pad, margin and gap on one quarter-rem scale.",
				href: href("utilities/spacing"),
				cta: "Browse utilities",
			},
			{
				eyebrow: "Concept",
				title: "Scales and tokens",
				description: "Change a scale or bring your own palette.",
				href: href("start/scales"),
				cta: "Read the concept",
			},
		],
		topics: [
			{ title: "The palettes", href: `${href("utilities/colour")}#palettes` },
			{ title: "grid", href: `${href("utilities/layout")}#grid` },
			{ title: "The type scale", href: `${href("utilities/typography")}#the-type-scale` },
			{ title: "shadow", href: `${href("utilities/effects")}#shadow` },
		],
		sections: [
			{
				title: "Get started",
				href: href("start/installation"),
				description: "Install, load the tokens, and make the scales yours.",
				count: 2,
			},
			{
				title: "Utilities",
				href: href("utilities/spacing"),
				description: "Every utility, drawn and grouped by what it styles.",
				countLabel: "16 utilities",
			},
		],
	},
	pages: {
		"start/installation": INSTALLATION,
		"start/scales": SCALES,
		"utilities/spacing": SPACING,
		"utilities/colour": COLOR,
		"utilities/layout": LAYOUT,
		"utilities/typography": TYPOGRAPHY,
		"utilities/effects": EFFECTS,
	},
} satisfies DemoDocsSite;
