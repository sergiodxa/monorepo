/**
 * Shared `css()` mixins for the r3-uptime UI. Centralizes the small set of layout,
 * typography, and control styles reused across layouts and views so pages share one
 * visual language instead of repeating inline styles. Exists as the app's replacement
 * for the Tailwind utility classes the OLD APP used.
 *
 * The color palette, font stacks, and semantic color usage below are copied verbatim
 * from the OLD APP's `@theme` block (`apps/uptime/app/assets/styles.css`) and cross-
 * checked against how its components actually use those tokens (hero, header, footer,
 * cards, badges, status banners). Colors are OKLCH, matching the OLD APP exactly, so
 * hue/lightness/chroma stay in lockstep with its design system instead of drifting to
 * an approximate hex value.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CSSMixinDescriptor, ElementProps, MixinDescriptor } from "remix/ui";

import { css } from "remix/ui";

/**
 * Re-types a `css()` mixin for a specific host element. `css()` binds its mixin to
 * the global `Element`, but `@cloudflare/workers-types` shadows `Element` with
 * HTMLRewriter's, so a plain `Element` mixin is not assignable to the `mix` prop once
 * JSX resolves an element to its concrete DOM type (e.g. `<select>`). Only the
 * compile-time type changes; the runtime value is identical.
 */
export function mixFor<Node extends EventTarget>(
	mixin: CSSMixinDescriptor,
): MixinDescriptor<Node, CSSMixinDescriptor["args"], ElementProps> {
	return mixin as unknown as MixinDescriptor<Node, CSSMixinDescriptor["args"], ElementProps>;
}

/**
 * Inserts an alpha channel into an `oklch(...)` (or any `fn(...)`) color string, e.g.
 * `alpha(primary[950], 0.2)` → `"oklch(0.24 0.06 142 / 0.2)"`. Mirrors the OLD APP's
 * Tailwind opacity modifiers (`bg-primary-950/20`) that plain OKLCH strings can't
 * express on their own.
 */
function alpha(color: string, value: number): string {
	return color.replace(/\)$/, ` / ${value})`);
}

/**
 * Neutral scale, hue 145 — a faint green tint matching the primary hue, per the OLD
 * APP's `--color-neutral-*` tokens (not a pure gray).
 */
export const neutral = {
	50: "oklch(0.98 0.005 145)",
	100: "oklch(0.96 0.005 145)",
	200: "oklch(0.91 0.008 145)",
	300: "oklch(0.83 0.01 145)",
	400: "oklch(0.73 0.01 145)",
	500: "oklch(0.62 0.01 145)",
	600: "oklch(0.52 0.01 145)",
	700: "oklch(0.42 0.008 145)",
	800: "oklch(0.32 0.006 145)",
	900: "oklch(0.24 0.005 145)",
	950: "oklch(0.16 0.004 145)",
} as const;

/** Primary (brand) scale, hue 142 — green, per the OLD APP's `--color-primary-*` tokens. */
export const primary = {
	50: "oklch(0.98 0.02 142)",
	100: "oklch(0.96 0.04 142)",
	200: "oklch(0.92 0.08 142)",
	300: "oklch(0.86 0.12 142)",
	400: "oklch(0.78 0.16 142)",
	500: "oklch(0.7 0.18 142)",
	600: "oklch(0.6 0.16 142)",
	700: "oklch(0.5 0.14 142)",
	800: "oklch(0.42 0.12 142)",
	900: "oklch(0.34 0.09 142)",
	950: "oklch(0.24 0.06 142)",
} as const;

/** Warning scale, hue 85 — amber, per the OLD APP's `--color-warning-*` tokens. */
export const warning = {
	50: "oklch(0.98 0.02 85)",
	100: "oklch(0.96 0.06 85)",
	200: "oklch(0.92 0.12 85)",
	300: "oklch(0.86 0.16 85)",
	400: "oklch(0.8 0.18 85)",
	500: "oklch(0.72 0.18 85)",
	600: "oklch(0.62 0.16 85)",
	700: "oklch(0.52 0.14 85)",
	800: "oklch(0.42 0.12 85)",
	900: "oklch(0.34 0.09 85)",
	950: "oklch(0.24 0.06 85)",
} as const;

/** Danger scale, hue 25 — red, per the OLD APP's `--color-danger-*` tokens. */
export const danger = {
	50: "oklch(0.98 0.02 25)",
	100: "oklch(0.96 0.04 25)",
	200: "oklch(0.92 0.1 25)",
	300: "oklch(0.86 0.14 25)",
	400: "oklch(0.78 0.18 25)",
	500: "oklch(0.68 0.2 25)",
	600: "oklch(0.58 0.18 25)",
	700: "oklch(0.48 0.16 25)",
	800: "oklch(0.4 0.14 25)",
	900: "oklch(0.32 0.1 25)",
	950: "oklch(0.22 0.06 25)",
} as const;

/** Success scale, hue 155 — teal-green, per the OLD APP's `--color-success-*` tokens. */
export const success = {
	50: "oklch(0.98 0.02 155)",
	100: "oklch(0.96 0.05 155)",
	200: "oklch(0.92 0.09 155)",
	300: "oklch(0.86 0.15 155)",
	400: "oklch(0.78 0.2 155)",
	500: "oklch(0.7 0.2 155)",
	600: "oklch(0.62 0.18 155)",
	700: "oklch(0.52 0.14 155)",
	800: "oklch(0.44 0.11 155)",
	900: "oklch(0.38 0.09 155)",
	950: "oklch(0.26 0.06 155)",
} as const;

/**
 * Marketing/docs font stack — the OLD APP's `--font-sans` (Mona Sans, with system
 * fallbacks). The OLD APP self-hosts a Mona Sans `.woff2` via `@font-face`; the
 * `css()` mixin system here only styles individual elements, with no global
 * stylesheet or asset pipeline to host a `@font-face` rule, so this ports the
 * fallback stack as-is and lets the browser substitute its default UI sans font.
 */
export const fontSans =
	'"Mona Sans", ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';

/**
 * App-shell/docs/status-page font stack — the OLD APP renders its `<body>` in
 * `font-mono` by default (see `apps/uptime/app/root.tsx`), reserving `font-sans` for
 * pages nested under its `_landing` layout route.
 */
export const fontMono =
	'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

/**
 * Document `<body>` styling: background/text color and the app-wide monospace font,
 * matching the OLD APP's `root.tsx` `<body className="... font-mono ... dark:...">`.
 * Marketing pages opt back into {@link fontSans} via {@link marketingFont}, mirroring
 * the OLD APP's `_landing.tsx` wrapper (`font-sans`) overriding the body default.
 */
export const documentBody = css({
	background: neutral[50],
	color: neutral[950],
	fontFamily: fontMono,
	"@media (prefers-color-scheme: dark)": {
		background: neutral[950],
		color: neutral[50],
	},
});

/** Centered, width-capped content column (public pages, the marketing landing page). */
export const container = css({
	maxWidth: 768,
	margin: "0 auto",
	padding: "40px 20px",
});

/** Page-level flex column filling the viewport height. */
export const page = css({
	display: "flex",
	flexDirection: "column",
	minHeight: "100vh",
});

/**
 * Additional mixin composed alongside {@link page} for the marketing layout's outer
 * wrapper, switching that subtree from the app-wide {@link fontMono} default to
 * {@link fontSans} — matching the OLD APP's `_landing.tsx` (`font-sans`).
 */
export const marketingFont = css({
	fontFamily: fontSans,
});

/** App-shell header bar: logo, team name, and user menu. */
export const header = css({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 16,
	padding: "12px 20px",
	borderBottom: `1px solid ${neutral[200]}`,
	"@media (prefers-color-scheme: dark)": {
		borderColor: neutral[800],
	},
});

/** Horizontal group of inline items (nav links, user info). */
export const row = css({
	display: "flex",
	alignItems: "center",
	gap: 12,
});

/** App-shell body: sidebar + main content, filling remaining height. */
export const shellBody = css({
	display: "flex",
	flex: 1,
	minHeight: 0,
});

/** Sidebar navigation column. */
export const sidebar = css({
	width: 220,
	flexShrink: 0,
	padding: "16px 12px",
	borderRight: `1px solid ${neutral[200]}`,
	"@media (prefers-color-scheme: dark)": {
		borderColor: neutral[800],
	},
});

/** Sidebar nav list, unstyled. */
export const navList = css({
	listStyle: "none",
	margin: 0,
	padding: 0,
	display: "flex",
	flexDirection: "column",
	gap: 4,
});

/** Main content area. */
export const main = css({
	flex: 1,
	padding: 24,
	overflow: "auto",
});

/** Muted small text (meta info, empty-state copy). */
export const mutedSmall = css({
	fontSize: "0.8125rem",
	color: neutral[500],
	"@media (prefers-color-scheme: dark)": {
		color: neutral[400],
	},
});

/** Plain text link, underlined on hover only. */
export const link = css({
	color: primary[600],
	textDecoration: "none",
	"&:hover": { textDecoration: "underline" },
	"@media (prefers-color-scheme: dark)": {
		color: primary[400],
	},
});

/**
 * Primary call-to-action button/link. The OLD APP's primary CTAs (hero, header,
 * final CTA) use `bg-primary-600` with no `dark:` override, since the brand green
 * already reads correctly against both light and dark surfaces.
 */
export const buttonPrimary = css({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	padding: "8px 16px",
	borderRadius: 6,
	border: "1px solid transparent",
	background: primary[600],
	color: "#ffffff",
	fontWeight: 500,
	cursor: "pointer",
	"&:hover": { background: primary[700] },
});

/** Empty-state placeholder box. */
export const emptyState = css({
	display: "flex",
	flexDirection: "column",
	alignItems: "flex-start",
	gap: 8,
	padding: 24,
	border: `1px dashed ${neutral[300]}`,
	borderRadius: 8,
	"@media (prefers-color-scheme: dark)": {
		borderColor: neutral[700],
	},
});

/** Vertical label + control stack for a form field. */
export const field = css({
	display: "flex",
	flexDirection: "column",
	gap: 4,
	marginBottom: 16,
	fontSize: "0.875rem",
	fontWeight: 500,
});

/** Horizontal checkbox + label row for a boolean form field. */
export const checkboxField = css({
	display: "flex",
	alignItems: "center",
	gap: 8,
	marginBottom: 16,
	fontSize: "0.875rem",
});

/** Text/number/url/select control matching the app's form field style. */
export const input = css({
	padding: "8px 10px",
	borderRadius: 6,
	border: `1px solid ${neutral[300]}`,
	fontSize: "0.9375rem",
	fontFamily: "inherit",
	background: "#ffffff",
	color: "inherit",
	"@media (prefers-color-scheme: dark)": {
		borderColor: neutral[700],
		background: neutral[900],
	},
});

/** {@link input} re-typed for `<select>` (see {@link mixFor}). */
export const selectInput = mixFor<HTMLSelectElement>(input);

/** Destructive action button/link. */
export const buttonDanger = css({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	padding: "8px 16px",
	borderRadius: 6,
	border: "1px solid transparent",
	background: danger[600],
	color: "#ffffff",
	fontWeight: 500,
	cursor: "pointer",
	"&:hover": { background: danger[700] },
});

/** Secondary (outline) button/link. */
export const buttonSecondary = css({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	padding: "8px 16px",
	borderRadius: 6,
	border: `1px solid ${neutral[300]}`,
	background: "#ffffff",
	color: neutral[700],
	fontWeight: 500,
	cursor: "pointer",
	textDecoration: "none",
	"&:hover": { background: neutral[50] },
	"@media (prefers-color-scheme: dark)": {
		borderColor: neutral[700],
		background: neutral[900],
		color: neutral[300],
		"&:hover": { background: neutral[800] },
	},
});

/** Native `<dialog>` surface for delete-confirmation prompts. */
export const dialog = css({
	padding: 24,
	borderRadius: 8,
	border: `1px solid ${neutral[300]}`,
	maxWidth: 400,
	"&::backdrop": {
		background: "rgba(0, 0, 0, 0.4)",
	},
	"@media (prefers-color-scheme: dark)": {
		borderColor: neutral[700],
		background: neutral[900],
		color: neutral[50],
	},
});

/** Full-width data table for monitor/result lists. */
export const table = css({
	width: "100%",
	borderCollapse: "collapse",
	fontSize: "0.875rem",
	"& th, & td": {
		textAlign: "left",
		padding: "8px 12px",
		borderBottom: `1px solid ${neutral[200]}`,
	},
	"@media (prefers-color-scheme: dark)": {
		"& th, & td": { borderColor: neutral[800] },
	},
});

/** Row of stat cards on the dashboard. */
export const statRow = css({
	display: "flex",
	flexWrap: "wrap",
	gap: 16,
	marginBottom: 24,
});

/** A single dashboard stat card. */
export const statCard = css({
	flex: "1 1 160px",
	padding: 16,
	borderRadius: 8,
	border: `1px solid ${neutral[200]}`,
	"@media (prefers-color-scheme: dark)": {
		borderColor: neutral[800],
	},
});

/** Large numeric value inside a stat card. */
export const statValue = css({
	fontSize: "1.75rem",
	fontWeight: 600,
	lineHeight: 1.2,
});

/** Status badge base; combine with a status-specific color mixin. */
export const badge = css({
	display: "inline-flex",
	alignItems: "center",
	padding: "2px 8px",
	borderRadius: 999,
	fontSize: "0.75rem",
	fontWeight: 600,
	textTransform: "capitalize",
});

/**
 * Green "up"/valid/healthy badge color, matching the OLD APP's status badges
 * (`bg-{color}-100 text-{color}-800 dark:bg-{color}-900/50 dark:text-{color}-200`)
 * translated from Tailwind green to the {@link success} scale.
 */
export const badgeUp = css({
	background: success[100],
	color: success[800],
	"@media (prefers-color-scheme: dark)": {
		background: alpha(success[900], 0.5),
		color: success[200],
	},
});

/** Amber "degraded"/expiring/late badge color. */
export const badgeDegraded = css({
	background: warning[100],
	color: warning[800],
	"@media (prefers-color-scheme: dark)": {
		background: alpha(warning[900], 0.5),
		color: warning[200],
	},
});

/** Red "down"/expired/error badge color. */
export const badgeDown = css({
	background: danger[100],
	color: danger[800],
	"@media (prefers-color-scheme: dark)": {
		background: alpha(danger[900], 0.5),
		color: danger[200],
	},
});

/** Gray "pending"/unknown/disabled badge color. */
export const badgeNeutral = css({
	background: neutral[100],
	color: neutral[800],
	"@media (prefers-color-scheme: dark)": {
		background: neutral[800],
		color: neutral[200],
	},
});

/** Horizontally-scrollable row of heatmap week-columns. */
export const heatmap = css({
	display: "flex",
	gap: 3,
	overflowX: "auto",
	padding: "4px 0",
});

/** One week's column of day-cells in the heatmap. */
export const heatmapWeek = css({
	display: "flex",
	flexDirection: "column",
	gap: 3,
});

/** One day-cell in the heatmap; combine with a status color mixin. */
export const heatmapCell = css({
	width: 11,
	height: 11,
	borderRadius: 2,
});

/** Heatmap cell: no data for that day yet. */
export const heatmapCellEmpty = css({
	background: neutral[200],
	"@media (prefers-color-scheme: dark)": { background: neutral[700] },
});

/**
 * Heatmap cell: fully up for that day. The OLD APP's heatmap legend swatches
 * (`bg-green-500`, `bg-yellow-500`, `bg-red-500`) have no `dark:` variant, so these
 * three stay flat across color schemes.
 */
export const heatmapCellUp = css({
	background: success[500],
});

/** Heatmap cell: degraded for that day. */
export const heatmapCellDegraded = css({
	background: warning[500],
});

/** Heatmap cell: down for that day. */
export const heatmapCellDown = css({
	background: danger[500],
});

/** Full-width status banner base; combine with a status-specific color mixin. */
export const banner = css({
	display: "flex",
	alignItems: "center",
	gap: 10,
	padding: "14px 18px",
	borderRadius: 8,
	border: "1px solid transparent",
	fontWeight: 600,
	marginBottom: 24,
});

/**
 * Green "all systems operational" banner color, matching the OLD APP's
 * `OverallStatusBanner` (`bg-green-50 dark:bg-green-950/30 border-green-200
 * dark:border-green-800 text-green-800 dark:text-green-200`) on the {@link success} scale.
 */
export const bannerOperational = css({
	background: success[50],
	borderColor: success[200],
	color: success[800],
	"@media (prefers-color-scheme: dark)": {
		background: alpha(success[950], 0.3),
		borderColor: success[800],
		color: success[200],
	},
});

/** Amber "partial outage" banner color. */
export const bannerDegraded = css({
	background: warning[50],
	borderColor: warning[200],
	color: warning[800],
	"@media (prefers-color-scheme: dark)": {
		background: alpha(warning[950], 0.3),
		borderColor: warning[800],
		color: warning[200],
	},
});

/** Red "major outage" banner color. */
export const bannerDown = css({
	background: danger[50],
	borderColor: danger[200],
	color: danger[800],
	"@media (prefers-color-scheme: dark)": {
		background: alpha(danger[950], 0.3),
		borderColor: danger[800],
		color: danger[200],
	},
});

/**
 * A single service row on the public status page, matching the OLD APP's
 * `MonitorCard`/`CronJobCard` (`border-neutral-200 bg-white dark:border-neutral-800
 * dark:bg-neutral-900`).
 */
export const serviceCard = css({
	display: "flex",
	flexDirection: "column",
	gap: 8,
	padding: 16,
	borderRadius: 8,
	border: `1px solid ${neutral[200]}`,
	background: "#ffffff",
	marginBottom: 12,
	"@media (prefers-color-scheme: dark)": {
		borderColor: neutral[800],
		background: neutral[900],
	},
});

/**
 * Sticky top navigation bar for the public marketing site, matching the OLD APP's
 * `LandingHeader` (`bg-white/80 backdrop-blur-md dark:bg-neutral-950/80`).
 */
export const marketingHeader = css({
	position: "sticky",
	top: 0,
	zIndex: 10,
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 16,
	padding: "14px 24px",
	borderBottom: `1px solid ${neutral[200]}`,
	background: "rgba(255, 255, 255, 0.8)",
	backdropFilter: "blur(12px)",
	"@media (prefers-color-scheme: dark)": {
		borderColor: neutral[800],
		background: alpha(neutral[950], 0.8),
	},
});

/** Marketing header brand mark. */
export const marketingBrand = css({
	fontWeight: 700,
	fontSize: "1.125rem",
	textDecoration: "none",
	color: neutral[900],
	"@media (prefers-color-scheme: dark)": { color: neutral[50] },
});

/** Horizontal row of marketing nav links. */
export const marketingNav = css({
	display: "flex",
	alignItems: "center",
	gap: 20,
	flexWrap: "wrap",
});

/** A single marketing nav link. */
export const marketingNavLink = css({
	fontSize: "0.9375rem",
	color: neutral[600],
	textDecoration: "none",
	"&:hover": { color: primary[600] },
	"@media (prefers-color-scheme: dark)": {
		color: neutral[400],
		"&:hover": { color: primary[400] },
	},
});

/** Centered, width-capped content column for marketing sections (wider than {@link container}). */
export const marketingContainer = css({
	maxWidth: 1024,
	margin: "0 auto",
	padding: "0 24px",
});

/**
 * Hero section with a soft gradient background, matching the OLD APP's hero
 * (`bg-gradient-to-b from-primary-50 to-white dark:from-primary-950/20 dark:to-neutral-950`).
 */
export const marketingHero = css({
	padding: "64px 0 48px",
	textAlign: "center",
	background: `linear-gradient(to bottom, ${primary[50]}, #ffffff)`,
	"@media (prefers-color-scheme: dark)": {
		background: `linear-gradient(to bottom, ${alpha(primary[950], 0.2)}, ${neutral[950]})`,
	},
});

/**
 * Small pill badge used above hero/section headings, matching the OLD APP's
 * `<Badge color="primary" variant="secondary">` (`@pkg/ui`'s secondary badge tokens).
 */
export const marketingBadge = css({
	display: "inline-flex",
	alignItems: "center",
	padding: "4px 12px",
	borderRadius: 999,
	fontSize: "0.75rem",
	fontWeight: 600,
	border: `1px solid ${primary[200]}`,
	background: primary[50],
	color: primary[600],
	marginBottom: 16,
	"@media (prefers-color-scheme: dark)": {
		borderColor: primary[800],
		background: primary[950],
		color: primary[400],
	},
});

/**
 * Hero/section heading, larger than default `h1`/`h2` sizing, matching the OLD APP's
 * hero `<h1>` (`text-neutral-900 dark:text-neutral-50`).
 */
export const marketingHeroTitle = css({
	fontSize: "2.25rem",
	fontWeight: 700,
	lineHeight: 1.15,
	margin: "0 auto 16px",
	maxWidth: 760,
	color: neutral[900],
	"@media (min-width: 768px)": { fontSize: "3rem" },
	"@media (prefers-color-scheme: dark)": { color: neutral[50] },
});

/**
 * Emphasized inline span inside a hero title, matching the OLD APP's
 * `<strong className="text-primary-600 dark:text-primary-400" />`.
 */
export const marketingHeroHighlight = css({
	color: primary[600],
	"@media (prefers-color-scheme: dark)": { color: primary[400] },
});

/**
 * Hero/section supporting paragraph, matching the OLD APP's hero description
 * (`text-neutral-600 dark:text-neutral-400`).
 */
export const marketingLead = css({
	fontSize: "1.125rem",
	color: neutral[600],
	margin: "0 auto 24px",
	maxWidth: 640,
	lineHeight: 1.6,
	"@media (prefers-color-scheme: dark)": { color: neutral[400] },
});

/** Row of short trust/highlight chips under a hero paragraph. */
export const marketingHighlightRow = css({
	display: "flex",
	flexWrap: "wrap",
	justifyContent: "center",
	gap: 12,
	marginBottom: 8,
});

/**
 * One chip inside {@link marketingHighlightRow}, matching the OLD APP's highlights
 * row (`text-neutral-500 dark:text-neutral-400`).
 */
export const marketingHighlightChip = css({
	display: "inline-flex",
	alignItems: "center",
	gap: 6,
	fontSize: "0.875rem",
	color: neutral[500],
	"@media (prefers-color-scheme: dark)": { color: neutral[400] },
});

/** Row of call-to-action buttons under a hero. */
export const marketingActions = css({
	display: "flex",
	flexWrap: "wrap",
	justifyContent: "center",
	gap: 12,
	marginTop: 8,
});

/** A generic marketing page section with vertical padding. */
export const marketingSection = css({
	padding: "48px 0",
});

/**
 * Same as {@link marketingSection} with an alternating background tint, matching the
 * OLD APP's alternate sections (`bg-neutral-50 dark:bg-neutral-900/50`).
 */
export const marketingSectionAlt = css({
	padding: "48px 0",
	background: neutral[50],
	"@media (prefers-color-scheme: dark)": { background: alpha(neutral[900], 0.5) },
});

/** Centered heading block at the top of a marketing section. */
export const marketingSectionHeader = css({
	textAlign: "center",
	maxWidth: 640,
	margin: "0 auto 40px",
});

/** Responsive card grid for feature/use-case/audience lists. */
export const marketingGrid = css({
	display: "grid",
	gap: 20,
	gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
});

/**
 * One card inside {@link marketingGrid}, matching the OLD APP's feature cards
 * (`border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900`).
 */
export const marketingCard = css({
	display: "block",
	padding: 20,
	borderRadius: 12,
	border: `1px solid ${neutral[200]}`,
	background: "#ffffff",
	color: "inherit",
	textDecoration: "none",
	"@media (prefers-color-scheme: dark)": {
		borderColor: neutral[800],
		background: neutral[900],
	},
});

/** Card/section heading inside a marketing card. */
export const marketingCardTitle = css({
	fontSize: "1.0625rem",
	fontWeight: 600,
	margin: "0 0 6px",
	color: neutral[900],
	"@media (prefers-color-scheme: dark)": { color: neutral[50] },
});

/** Card description text, muted. */
export const marketingCardDescription = css({
	fontSize: "0.9375rem",
	color: neutral[600],
	margin: 0,
	lineHeight: 1.55,
	"@media (prefers-color-scheme: dark)": { color: neutral[400] },
});

/** Row of stat tiles (trust indicators). */
export const marketingStatRow = css({
	display: "grid",
	gap: 16,
	gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
	textAlign: "center",
});

/**
 * Large numeric stat value, matching the OLD APP's trust-indicator figures
 * (`text-3xl font-bold text-neutral-900 dark:text-neutral-50`, numerals in `font-mono`).
 */
export const marketingStatValue = css({
	fontSize: "1.75rem",
	fontWeight: 700,
	fontFamily: fontMono,
	color: neutral[900],
	"@media (prefers-color-scheme: dark)": { color: neutral[50] },
});

/** Muted label under a stat value. */
export const marketingStatLabel = css({
	fontSize: "0.8125rem",
	color: neutral[600],
	"@media (prefers-color-scheme: dark)": { color: neutral[400] },
});

/** Numbered "how it works" step list. */
export const marketingSteps = css({
	display: "grid",
	gap: 20,
	gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
	counterReset: "marketing-step",
});

/**
 * One step inside {@link marketingSteps}, numbered via `::before`, matching the OLD
 * APP's step circles (`bg-primary-600 text-white`).
 */
export const marketingStep = css({
	position: "relative",
	paddingLeft: 40,
	counterIncrement: "marketing-step",
	"&::before": {
		content: "counter(marketing-step)",
		position: "absolute",
		left: 0,
		top: 0,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		width: 28,
		height: 28,
		borderRadius: "50%",
		background: primary[600],
		color: "#ffffff",
		fontSize: "0.8125rem",
		fontWeight: 700,
	},
});

/**
 * Native `<details>` FAQ item; no client JS required for the disclosure behavior.
 * Matches the OLD APP's FAQ accordion items (`border-neutral-200 bg-white
 * dark:border-neutral-800 dark:bg-neutral-900`).
 */
export const marketingFaqItem = css({
	border: `1px solid ${neutral[200]}`,
	background: "#ffffff",
	borderRadius: 8,
	padding: "12px 16px",
	marginBottom: 12,
	"@media (prefers-color-scheme: dark)": {
		borderColor: neutral[800],
		background: neutral[900],
	},
});

/**
 * `<summary>` question row of a {@link marketingFaqItem}, matching the OLD APP's
 * `Accordion.Trigger` (`font-semibold text-neutral-900 dark:text-neutral-50`).
 */
export const marketingFaqQuestion = css({
	fontWeight: 600,
	cursor: "pointer",
	color: neutral[900],
	"@media (prefers-color-scheme: dark)": { color: neutral[50] },
});

/**
 * Answer paragraph inside an open {@link marketingFaqItem}, matching the OLD APP's
 * `Accordion.Content` divider and muted text (`border-t border-neutral-200
 * text-neutral-600 dark:border-neutral-800 dark:text-neutral-400`).
 */
export const marketingFaqAnswer = css({
	marginTop: 8,
	paddingTop: 12,
	borderTop: `1px solid ${neutral[200]}`,
	color: neutral[600],
	lineHeight: 1.6,
	"@media (prefers-color-scheme: dark)": {
		borderColor: neutral[800],
		color: neutral[400],
	},
});

/**
 * Final call-to-action band near the bottom of a marketing page, matching the OLD
 * APP's `LandingFinalCTA` (`bg-gradient-to-r from-primary-600 to-primary-700`).
 */
export const marketingCtaSection = css({
	padding: "56px 0",
	textAlign: "center",
	background: `linear-gradient(to right, ${primary[600]}, ${primary[700]})`,
	color: "#ffffff",
});

/** Comparison table used on `/vs/*` pages; extends {@link table} with centered data cells. */
export const marketingComparisonTable = css({
	width: "100%",
	borderCollapse: "collapse",
	fontSize: "0.9375rem",
	"& th, & td": {
		textAlign: "center",
		padding: "10px 12px",
		borderBottom: `1px solid ${neutral[200]}`,
	},
	"& th:first-child, & td:first-child": { textAlign: "left" },
	"@media (prefers-color-scheme: dark)": {
		"& th, & td": { borderColor: neutral[800] },
	},
});

/**
 * Marketing site footer, matching the OLD APP's `LandingFooter`
 * (`border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950`).
 */
export const marketingFooter = css({
	borderTop: `1px solid ${neutral[200]}`,
	background: "#ffffff",
	padding: "48px 24px 24px",
	"@media (prefers-color-scheme: dark)": {
		borderColor: neutral[800],
		background: neutral[950],
	},
});

/** Multi-column link grid inside the marketing footer. */
export const marketingFooterGrid = css({
	display: "grid",
	gap: 24,
	gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
	maxWidth: 1024,
	margin: "0 auto 32px",
});

/**
 * One column heading inside the footer grid, matching the OLD APP's footer column
 * `<h3>` (`text-sm font-semibold text-neutral-900 dark:text-neutral-50` — not
 * uppercased or letter-spaced).
 */
export const marketingFooterHeading = css({
	fontSize: "0.875rem",
	fontWeight: 600,
	color: neutral[900],
	marginBottom: 12,
	"@media (prefers-color-scheme: dark)": { color: neutral[50] },
});

/**
 * One link inside a footer column, matching the OLD APP's footer links
 * (`text-neutral-600 hover:text-primary-600 dark:text-neutral-400
 * dark:hover:text-primary-400`).
 */
export const marketingFooterLink = css({
	display: "block",
	fontSize: "0.875rem",
	color: neutral[600],
	textDecoration: "none",
	marginBottom: 8,
	"&:hover": { color: primary[600] },
	"@media (prefers-color-scheme: dark)": {
		color: neutral[400],
		"&:hover": { color: primary[400] },
	},
});

/**
 * Bottom copyright row of the marketing footer, matching the OLD APP's footer
 * copyright line (centered, muted, no separator rule above it).
 */
export const marketingFooterBottom = css({
	maxWidth: 1024,
	margin: "0 auto",
	marginTop: 24,
	textAlign: "center",
	fontSize: "0.8125rem",
	color: neutral[500],
	"@media (prefers-color-scheme: dark)": {
		color: neutral[400],
	},
});

/** Long-form prose article (legal pages, docs). */
export const proseArticle = css({
	maxWidth: 720,
	margin: "0 auto",
	padding: "48px 24px 80px",
	lineHeight: 1.7,
	color: neutral[800],
	"& h1": { fontSize: "2rem", marginBottom: 8, color: neutral[900] },
	"& h2": { fontSize: "1.375rem", marginTop: 32, marginBottom: 8, color: neutral[900] },
	"& h3": { fontSize: "1.125rem", marginTop: 24, marginBottom: 8, color: neutral[900] },
	"& p": { margin: "0 0 16px" },
	"& ul": { margin: "0 0 16px", paddingLeft: "1.25rem" },
	"& li": { marginBottom: 8 },
	"@media (prefers-color-scheme: dark)": {
		color: neutral[300],
		"& h1, & h2, & h3": { color: neutral[50] },
	},
});

/** Two-column docs layout: sidebar navigation + article content. */
export const docsLayout = css({
	display: "flex",
	flex: 1,
	minHeight: 0,
	maxWidth: 1024,
	margin: "0 auto",
	width: "100%",
});

/** Docs sidebar navigation column. */
export const docsSidebar = css({
	width: 240,
	flexShrink: 0,
	padding: "32px 20px",
	borderRight: `1px solid ${neutral[200]}`,
	"@media (prefers-color-scheme: dark)": { borderColor: neutral[800] },
});

/** One doc section heading inside the docs sidebar. */
export const docsSidebarHeading = css({
	fontSize: "0.75rem",
	fontWeight: 700,
	textTransform: "uppercase",
	letterSpacing: "0.03em",
	color: neutral[500],
	margin: "20px 0 8px",
	"@media (prefers-color-scheme: dark)": { color: neutral[400] },
});

/** Docs article content column. */
export const docsContent = css({
	flex: 1,
	minWidth: 0,
	padding: "32px 24px 80px",
});

/** Intro paragraph under the docs index `<h1>`. */
export const docsIntro = css({
	fontSize: "1.0625rem",
	color: neutral[600],
	margin: "8px 0 32px",
	"@media (prefers-color-scheme: dark)": { color: neutral[400] },
});

/**
 * Centered card used for the homepage's "tailored solutions for" audience-chip row.
 * Matches the same card treatment as {@link marketingCard}.
 */
export const marketingAudienceCard = css({
	padding: 20,
	borderRadius: 12,
	border: `1px solid ${neutral[200]}`,
	background: "#ffffff",
	marginTop: 24,
	textAlign: "center",
	"@media (prefers-color-scheme: dark)": {
		borderColor: neutral[800],
		background: neutral[900],
	},
});

/** Fixed-position flash toast, auto-dismissed with a CSS animation. */
export const toast = css({
	position: "fixed",
	bottom: 16,
	right: 16,
	padding: "10px 16px",
	borderRadius: 6,
	background: neutral[800],
	color: "#ffffff",
	fontSize: "0.875rem",
	animation: "uptime-toast-fade 5s ease forwards",
	"@keyframes uptime-toast-fade": {
		"0%": { opacity: 1 },
		"85%": { opacity: 1 },
		"100%": { opacity: 0, visibility: "hidden" },
	},
});
