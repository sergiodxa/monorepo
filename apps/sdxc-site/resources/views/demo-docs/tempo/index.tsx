/**
 * The utilities docs demo: Tempo, an invented date-and-time helpers library, documented as
 * an overview and a function reference whose long pages lean on the heading rail. Set in a
 * technical register: cool neutrals, a teal-green accent, mono headings and square corners.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DemoDocsSite } from "~/resources/views/demo-docs";

import { demoDocsHref } from "~/resources/views/demo-docs";
import { INSTALLATION, TIME_ZONES } from "~/resources/views/demo-docs/tempo/overview";
import {
	ARITHMETIC,
	COMPARISON,
	FORMATTING,
	RANGES,
} from "~/resources/views/demo-docs/tempo/reference";

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

/** The Tempo mark: a clock face reduced to a prompt and a cursor. */
function mark() {
	return (
		<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
			<rect x="2" y="2" width="20" height="20" rx="3" fill="var(--ui-color-brand-600)" />
			<path d="M7 8l4 4-4 4" fill="none" stroke="white" stroke-width="2" stroke-linecap="square" />
			<path d="M13 16h4" stroke="white" stroke-width="2" />
		</svg>
	);
}

export default {
	name: "Tempo",
	kind: "Utilities docs",
	description:
		"Reference for Tempo, an invented library of date and time helpers: signatures, parameters, returns and an example for every function.",
	mark,
	theme: { brand: BRAND, neutral: NEUTRAL, tokens: TOKENS },
	tree: {
		label: "Tempo docs",
		sections: [
			{
				title: "Overview",
				items: [
					{ title: "Installation", href: href("overview/installation") },
					{ title: "Time zones", href: href("overview/time-zones") },
				],
			},
			{
				title: "Reference",
				items: [
					{ title: "Arithmetic", href: href("reference/arithmetic") },
					{ title: "Comparison", href: href("reference/comparison") },
					{ title: "Formatting", href: href("reference/formatting"), badge: "Intl" },
					{ title: "Ranges", href: href("reference/ranges") },
				],
			},
		],
	},
	hub: {
		eyebrow: "@tempo/core",
		title: "Dates without the surprises",
		lead: "Small, pure functions over the built-in Date: calendar-aware arithmetic, comparisons at any precision, and formatting through Intl. Every function is documented with its signature and an example.",
		start: [
			{
				eyebrow: "Overview",
				title: "Installation",
				description: "Install the package and pick an import path.",
				href: href("overview/installation"),
				cta: "Install Tempo",
			},
			{
				eyebrow: "Reference",
				title: "Arithmetic",
				description: "addDays, addMonths, addBusinessDays, subtract, difference and clamp.",
				href: href("reference/arithmetic"),
				cta: "Browse functions",
			},
			{
				eyebrow: "Concept",
				title: "Time zones",
				description: "Instants, wall-clock time, and which zone each function uses.",
				href: href("overview/time-zones"),
				cta: "Read the concept",
			},
		],
		topics: [
			{ title: "addBusinessDays", href: `${href("reference/arithmetic")}#addBusinessDays` },
			{ title: "isSame", href: `${href("reference/comparison")}#isSame` },
			{ title: "formatRelative", href: `${href("reference/formatting")}#formatRelative` },
			{ title: "overlaps", href: `${href("reference/ranges")}#overlaps` },
		],
		sections: [
			{
				title: "Overview",
				href: href("overview/installation"),
				description: "Install, import, and how time zones work.",
				count: 2,
			},
			{
				title: "Reference",
				href: href("reference/arithmetic"),
				description: "Every function, grouped by what it does.",
				countLabel: "19 functions",
			},
		],
	},
	pages: {
		"overview/installation": INSTALLATION,
		"overview/time-zones": TIME_ZONES,
		"reference/arithmetic": ARITHMETIC,
		"reference/comparison": COMPARISON,
		"reference/formatting": FORMATTING,
		"reference/ranges": RANGES,
	},
} satisfies DemoDocsSite;
