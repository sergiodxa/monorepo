/**
 * The component docs demo: Lattice UI, an invented component library, documented as a
 * component index, setup pages and one page per component with live previews, props and
 * accessibility notes. Set crisp and monochrome, with one violet accent and small radii.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DemoDocsSite } from "~/resources/views/demo-docs";

import { demoDocsHref } from "~/resources/views/demo-docs";
import { BADGE, BUTTON, CARD, SWITCH } from "~/resources/views/demo-docs/lattice/components";
import { INSTALLATION, THEMING } from "~/resources/views/demo-docs/lattice/start";

/** The addresses of Lattice's pages. */
const href = demoDocsHref("lattice");

/** A violet ramp at hue 290, the only colour on an otherwise monochrome page. */
const BRAND = [
	"oklch(0.982 0.012 290)",
	"oklch(0.952 0.03 290)",
	"oklch(0.9 0.062 290)",
	"oklch(0.82 0.11 290)",
	"oklch(0.71 0.165 290)",
	"oklch(0.6 0.2 290)",
	"oklch(0.52 0.21 290)",
	"oklch(0.45 0.19 290)",
	"oklch(0.37 0.155 290)",
	"oklch(0.29 0.115 290)",
	"oklch(0.2 0.08 290)",
] as const;

/** True greys with no tint, so components read as ink and the violet as their only accent. */
const NEUTRAL = [
	"oklch(0.985 0 0)",
	"oklch(0.967 0 0)",
	"oklch(0.922 0 0)",
	"oklch(0.85 0 0)",
	"oklch(0.708 0 0)",
	"oklch(0.556 0 0)",
	"oklch(0.47 0 0)",
	"oklch(0.39 0 0)",
	"oklch(0.29 0 0)",
	"oklch(0.205 0 0)",
	"oklch(0.145 0 0)",
] as const;

/** A tight grotesk, small corners and the body's face for headings. */
const TOKENS = {
	"--ui-font-sans": "Geist, Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
	"--ui-font-mono": "'Geist Mono', 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace",
	"--demo-docs-heading-weight": "600",
	"--ui-radius-md": "0.25rem",
	"--ui-radius-lg": "0.375rem",
} as const;

/** The Lattice mark: a two-by-two grid with one cell lit. */
function mark() {
	return (
		<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
			<rect x="2" y="2" width="9" height="9" rx="1.5" fill="var(--ui-color-brand-600)" />
			<rect
				x="13"
				y="2"
				width="9"
				height="9"
				rx="1.5"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
			/>
			<rect
				x="2"
				y="13"
				width="9"
				height="9"
				rx="1.5"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
			/>
			<rect
				x="13"
				y="13"
				width="9"
				height="9"
				rx="1.5"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
			/>
		</svg>
	);
}

export default {
	name: "Lattice",
	kind: "Component docs",
	description:
		"Docs for Lattice UI, a component library: an index of components, each with live previews, props and accessibility notes.",
	mark,
	theme: { brand: BRAND, neutral: NEUTRAL, tokens: TOKENS },
	tree: {
		label: "Lattice docs",
		sections: [
			{
				title: "Getting started",
				items: [
					{ title: "Installation", href: href("getting-started/installation") },
					{ title: "Theming", href: href("getting-started/theming") },
				],
			},
			{
				title: "Components",
				items: [
					{ title: "Badge", href: href("components/badge") },
					{ title: "Button", href: href("components/button") },
					{ title: "Card", href: href("components/card") },
					{ title: "Switch", href: href("components/switch"), badge: "New" },
				],
			},
		],
	},
	hub: {
		eyebrow: "Lattice UI",
		title: "Components that render on the server",
		lead: "Accessible, themeable components with no client runtime. Install the package, set your tokens, and pick a component below.",
		start: [
			{
				eyebrow: "Getting started",
				title: "Installation",
				description: "Add the package and its stylesheet, then render a component.",
				href: href("getting-started/installation"),
				cta: "Install Lattice",
			},
			{
				eyebrow: "Getting started",
				title: "Theming",
				description: "Swap the accent, radii and fonts with a few tokens.",
				href: href("getting-started/theming"),
				cta: "Theme it",
			},
			{
				eyebrow: "Component",
				title: "Button",
				description: "Four variants, three sizes, icons and a pending state.",
				href: href("components/button"),
				cta: "See the button",
			},
		],
		topics: [
			{ title: "Badge", href: href("components/badge") },
			{ title: "Button", href: href("components/button") },
			{ title: "Card", href: href("components/card") },
			{ title: "Switch", href: href("components/switch") },
			{ title: "Dark mode", href: `${href("getting-started/theming")}#dark-mode` },
		],
		sections: [
			{
				title: "Getting started",
				href: href("getting-started/installation"),
				description: "Install the package and make it yours.",
				count: 2,
			},
			{
				title: "Actions",
				href: href("components/button"),
				description: "Button: start an action, from a form submit to a dialog.",
				countLabel: "1 component",
			},
			{
				title: "Status",
				href: href("components/badge"),
				description: "Badge: say what state a record is in.",
				countLabel: "1 component",
			},
			{
				title: "Forms",
				href: href("components/switch"),
				description: "Switch: turn a setting on or off at once.",
				countLabel: "1 component",
			},
			{
				title: "Layout",
				href: href("components/card"),
				description: "Card: group one record with its actions.",
				countLabel: "1 component",
			},
		],
	},
	pages: {
		"getting-started/installation": INSTALLATION,
		"getting-started/theming": THEMING,
		"components/badge": BADGE,
		"components/button": BUTTON,
		"components/card": CARD,
		"components/switch": SWITCH,
	},
} satisfies DemoDocsSite;
