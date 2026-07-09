/**
 * Shared `css()` mixins for the r3-uptime UI. Centralizes the small set of layout,
 * typography, and control styles reused across layouts and views so pages share one
 * visual language instead of repeating inline styles. Exists as the app's replacement
 * for the Tailwind utility classes the OLD APP used.
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
	fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
	color: "#171717",
	background: "#ffffff",
	"@media (prefers-color-scheme: dark)": {
		color: "#e5e5e5",
		background: "#0a0a0a",
	},
});

/** App-shell header bar: logo, team name, and user menu. */
export const header = css({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 16,
	padding: "12px 20px",
	borderBottom: "1px solid #e5e5e5",
	"@media (prefers-color-scheme: dark)": {
		borderColor: "#262626",
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
	borderRight: "1px solid #e5e5e5",
	"@media (prefers-color-scheme: dark)": {
		borderColor: "#262626",
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
	color: "#737373",
	"@media (prefers-color-scheme: dark)": {
		color: "#a3a3a3",
	},
});

/** Plain text link, underlined on hover only. */
export const link = css({
	color: "#2563eb",
	textDecoration: "none",
	"&:hover": { textDecoration: "underline" },
	"@media (prefers-color-scheme: dark)": {
		color: "#60a5fa",
	},
});

/** Primary call-to-action button/link. */
export const buttonPrimary = css({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	padding: "8px 16px",
	borderRadius: 6,
	border: "1px solid transparent",
	background: "#171717",
	color: "#ffffff",
	fontWeight: 500,
	cursor: "pointer",
	"&:hover": { background: "#404040" },
	"@media (prefers-color-scheme: dark)": {
		background: "#e5e5e5",
		color: "#171717",
		"&:hover": { background: "#d4d4d4" },
	},
});

/** Empty-state placeholder box. */
export const emptyState = css({
	display: "flex",
	flexDirection: "column",
	alignItems: "flex-start",
	gap: 8,
	padding: 24,
	border: "1px dashed #d4d4d4",
	borderRadius: 8,
	"@media (prefers-color-scheme: dark)": {
		borderColor: "#404040",
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
	border: "1px solid #d4d4d4",
	fontSize: "0.9375rem",
	fontFamily: "inherit",
	background: "#ffffff",
	color: "inherit",
	"@media (prefers-color-scheme: dark)": {
		borderColor: "#404040",
		background: "#171717",
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
	background: "#dc2626",
	color: "#ffffff",
	fontWeight: 500,
	cursor: "pointer",
	"&:hover": { background: "#b91c1c" },
});

/** Secondary (outline) button/link. */
export const buttonSecondary = css({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	padding: "8px 16px",
	borderRadius: 6,
	border: "1px solid #d4d4d4",
	background: "transparent",
	color: "inherit",
	fontWeight: 500,
	cursor: "pointer",
	textDecoration: "none",
	"@media (prefers-color-scheme: dark)": {
		borderColor: "#404040",
	},
});

/** Native `<dialog>` surface for delete-confirmation prompts. */
export const dialog = css({
	padding: 24,
	borderRadius: 8,
	border: "1px solid #d4d4d4",
	maxWidth: 400,
	"&::backdrop": {
		background: "rgba(0, 0, 0, 0.4)",
	},
	"@media (prefers-color-scheme: dark)": {
		borderColor: "#404040",
		background: "#171717",
		color: "#e5e5e5",
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
		borderBottom: "1px solid #e5e5e5",
	},
	"@media (prefers-color-scheme: dark)": {
		"& th, & td": { borderColor: "#262626" },
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
	border: "1px solid #e5e5e5",
	"@media (prefers-color-scheme: dark)": {
		borderColor: "#262626",
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

/** Green "up"/valid/healthy badge color. */
export const badgeUp = css({
	background: "#dcfce7",
	color: "#166534",
	"@media (prefers-color-scheme: dark)": { background: "#052e16", color: "#4ade80" },
});

/** Amber "degraded"/expiring/late badge color. */
export const badgeDegraded = css({
	background: "#fef3c7",
	color: "#92400e",
	"@media (prefers-color-scheme: dark)": { background: "#451a03", color: "#fbbf24" },
});

/** Red "down"/expired/error badge color. */
export const badgeDown = css({
	background: "#fee2e2",
	color: "#991b1b",
	"@media (prefers-color-scheme: dark)": { background: "#450a0a", color: "#f87171" },
});

/** Gray "pending"/unknown/disabled badge color. */
export const badgeNeutral = css({
	background: "#f5f5f5",
	color: "#525252",
	"@media (prefers-color-scheme: dark)": { background: "#262626", color: "#a3a3a3" },
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
	background: "#f5f5f5",
	"@media (prefers-color-scheme: dark)": { background: "#262626" },
});

/** Heatmap cell: fully up for that day. */
export const heatmapCellUp = css({
	background: "#22c55e",
	"@media (prefers-color-scheme: dark)": { background: "#16a34a" },
});

/** Heatmap cell: degraded for that day. */
export const heatmapCellDegraded = css({
	background: "#f59e0b",
	"@media (prefers-color-scheme: dark)": { background: "#d97706" },
});

/** Heatmap cell: down for that day. */
export const heatmapCellDown = css({
	background: "#ef4444",
	"@media (prefers-color-scheme: dark)": { background: "#dc2626" },
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

/** Green "all systems operational" banner color. */
export const bannerOperational = css({
	background: "#f0fdf4",
	borderColor: "#bbf7d0",
	color: "#166534",
	"@media (prefers-color-scheme: dark)": {
		background: "#052e16",
		borderColor: "#14532d",
		color: "#4ade80",
	},
});

/** Amber "partial outage" banner color. */
export const bannerDegraded = css({
	background: "#fffbeb",
	borderColor: "#fde68a",
	color: "#92400e",
	"@media (prefers-color-scheme: dark)": {
		background: "#451a03",
		borderColor: "#78350f",
		color: "#fbbf24",
	},
});

/** Red "major outage" banner color. */
export const bannerDown = css({
	background: "#fef2f2",
	borderColor: "#fecaca",
	color: "#991b1b",
	"@media (prefers-color-scheme: dark)": {
		background: "#450a0a",
		borderColor: "#7f1d1d",
		color: "#f87171",
	},
});

/** A single service row on the public status page. */
export const serviceCard = css({
	display: "flex",
	flexDirection: "column",
	gap: 8,
	padding: 16,
	borderRadius: 8,
	border: "1px solid #e5e5e5",
	marginBottom: 12,
	"@media (prefers-color-scheme: dark)": {
		borderColor: "#262626",
	},
});

/** Sticky top navigation bar for the public marketing site. */
export const marketingHeader = css({
	position: "sticky",
	top: 0,
	zIndex: 10,
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 16,
	padding: "14px 24px",
	borderBottom: "1px solid #e5e5e5",
	background: "rgba(255, 255, 255, 0.9)",
	backdropFilter: "blur(6px)",
	"@media (prefers-color-scheme: dark)": {
		borderColor: "#262626",
		background: "rgba(10, 10, 10, 0.9)",
	},
});

/** Marketing header brand mark. */
export const marketingBrand = css({
	fontWeight: 700,
	fontSize: "1.125rem",
	textDecoration: "none",
	color: "inherit",
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
	color: "inherit",
	textDecoration: "none",
	"&:hover": { color: "#2563eb" },
});

/** Centered, width-capped content column for marketing sections (wider than {@link container}). */
export const marketingContainer = css({
	maxWidth: 1024,
	margin: "0 auto",
	padding: "0 24px",
});

/** Hero section with a soft gradient background. */
export const marketingHero = css({
	padding: "64px 0 48px",
	textAlign: "center",
	background: "linear-gradient(to bottom, #eff6ff, #ffffff)",
	"@media (prefers-color-scheme: dark)": {
		background: "linear-gradient(to bottom, #0c1a2e, #0a0a0a)",
	},
});

/** Small pill badge used above hero/section headings. */
export const marketingBadge = css({
	display: "inline-flex",
	alignItems: "center",
	padding: "4px 12px",
	borderRadius: 999,
	fontSize: "0.75rem",
	fontWeight: 600,
	background: "#dbeafe",
	color: "#1d4ed8",
	marginBottom: 16,
	"@media (prefers-color-scheme: dark)": {
		background: "#1e3a5f",
		color: "#93c5fd",
	},
});

/** Hero/section heading, larger than default `h1`/`h2` sizing. */
export const marketingHeroTitle = css({
	fontSize: "2.25rem",
	fontWeight: 700,
	lineHeight: 1.15,
	margin: "0 auto 16px",
	maxWidth: 760,
	"@media (min-width: 768px)": { fontSize: "3rem" },
});

/** Emphasized inline span inside a hero title. */
export const marketingHeroHighlight = css({
	color: "#2563eb",
	"@media (prefers-color-scheme: dark)": { color: "#60a5fa" },
});

/** Hero/section supporting paragraph. */
export const marketingLead = css({
	fontSize: "1.125rem",
	color: "#525252",
	margin: "0 auto 24px",
	maxWidth: 640,
	lineHeight: 1.6,
	"@media (prefers-color-scheme: dark)": { color: "#a3a3a3" },
});

/** Row of short trust/highlight chips under a hero paragraph. */
export const marketingHighlightRow = css({
	display: "flex",
	flexWrap: "wrap",
	justifyContent: "center",
	gap: 12,
	marginBottom: 8,
});

/** One chip inside {@link marketingHighlightRow}. */
export const marketingHighlightChip = css({
	display: "inline-flex",
	alignItems: "center",
	gap: 6,
	fontSize: "0.875rem",
	color: "#404040",
	"@media (prefers-color-scheme: dark)": { color: "#d4d4d4" },
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

/** Same as {@link marketingSection} with an alternating background tint. */
export const marketingSectionAlt = css({
	padding: "48px 0",
	background: "#fafafa",
	"@media (prefers-color-scheme: dark)": { background: "#111111" },
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

/** One card inside {@link marketingGrid}. */
export const marketingCard = css({
	padding: 20,
	borderRadius: 12,
	border: "1px solid #e5e5e5",
	"@media (prefers-color-scheme: dark)": { borderColor: "#262626" },
});

/** Card/section heading inside a marketing card. */
export const marketingCardTitle = css({
	fontSize: "1.0625rem",
	fontWeight: 600,
	margin: "0 0 6px",
});

/** Card description text, muted. */
export const marketingCardDescription = css({
	fontSize: "0.9375rem",
	color: "#525252",
	margin: 0,
	lineHeight: 1.55,
	"@media (prefers-color-scheme: dark)": { color: "#a3a3a3" },
});

/** Row of stat tiles (trust indicators). */
export const marketingStatRow = css({
	display: "grid",
	gap: 16,
	gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
	textAlign: "center",
});

/** Large numeric stat value. */
export const marketingStatValue = css({
	fontSize: "1.75rem",
	fontWeight: 700,
	fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
});

/** Muted label under a stat value. */
export const marketingStatLabel = css({
	fontSize: "0.8125rem",
	color: "#737373",
	"@media (prefers-color-scheme: dark)": { color: "#a3a3a3" },
});

/** Numbered "how it works" step list. */
export const marketingSteps = css({
	display: "grid",
	gap: 20,
	gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
	counterReset: "marketing-step",
});

/** One step inside {@link marketingSteps}, numbered via `::before`. */
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
		background: "#2563eb",
		color: "#ffffff",
		fontSize: "0.8125rem",
		fontWeight: 700,
	},
});

/** Native `<details>` FAQ item; no client JS required for the disclosure behavior. */
export const marketingFaqItem = css({
	border: "1px solid #e5e5e5",
	borderRadius: 8,
	padding: "12px 16px",
	marginBottom: 12,
	"@media (prefers-color-scheme: dark)": { borderColor: "#262626" },
});

/** `<summary>` question row of a {@link marketingFaqItem}. */
export const marketingFaqQuestion = css({
	fontWeight: 600,
	cursor: "pointer",
});

/** Answer paragraph inside an open {@link marketingFaqItem}. */
export const marketingFaqAnswer = css({
	marginTop: 8,
	color: "#525252",
	lineHeight: 1.6,
	"@media (prefers-color-scheme: dark)": { color: "#a3a3a3" },
});

/** Final call-to-action band near the bottom of a marketing page. */
export const marketingCtaSection = css({
	padding: "56px 0",
	textAlign: "center",
	background: "#171717",
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
		borderBottom: "1px solid #e5e5e5",
	},
	"& th:first-child, & td:first-child": { textAlign: "left" },
	"@media (prefers-color-scheme: dark)": {
		"& th, & td": { borderColor: "#262626" },
	},
});

/** Marketing site footer. */
export const marketingFooter = css({
	borderTop: "1px solid #e5e5e5",
	padding: "48px 24px 24px",
	"@media (prefers-color-scheme: dark)": { borderColor: "#262626" },
});

/** Multi-column link grid inside the marketing footer. */
export const marketingFooterGrid = css({
	display: "grid",
	gap: 24,
	gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
	maxWidth: 1024,
	margin: "0 auto 32px",
});

/** One column heading inside the footer grid. */
export const marketingFooterHeading = css({
	fontSize: "0.8125rem",
	fontWeight: 700,
	textTransform: "uppercase",
	letterSpacing: "0.03em",
	color: "#737373",
	marginBottom: 12,
	"@media (prefers-color-scheme: dark)": { color: "#a3a3a3" },
});

/** One link inside a footer column. */
export const marketingFooterLink = css({
	display: "block",
	fontSize: "0.875rem",
	color: "inherit",
	textDecoration: "none",
	marginBottom: 8,
	"&:hover": { color: "#2563eb" },
});

/** Bottom copyright row of the marketing footer. */
export const marketingFooterBottom = css({
	maxWidth: 1024,
	margin: "0 auto",
	paddingTop: 24,
	borderTop: "1px solid #e5e5e5",
	fontSize: "0.8125rem",
	color: "#737373",
	"@media (prefers-color-scheme: dark)": {
		borderColor: "#262626",
		color: "#a3a3a3",
	},
});

/** Long-form prose article (legal pages, docs). */
export const proseArticle = css({
	maxWidth: 720,
	margin: "0 auto",
	padding: "48px 24px 80px",
	lineHeight: 1.7,
	"& h1": { fontSize: "2rem", marginBottom: 8 },
	"& h2": { fontSize: "1.375rem", marginTop: 32, marginBottom: 8 },
	"& h3": { fontSize: "1.125rem", marginTop: 24, marginBottom: 8 },
	"& p": { margin: "0 0 16px" },
	"& ul": { margin: "0 0 16px", paddingLeft: "1.25rem" },
	"& li": { marginBottom: 8 },
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
	borderRight: "1px solid #e5e5e5",
	"@media (prefers-color-scheme: dark)": { borderColor: "#262626" },
});

/** One doc section heading inside the docs sidebar. */
export const docsSidebarHeading = css({
	fontSize: "0.75rem",
	fontWeight: 700,
	textTransform: "uppercase",
	letterSpacing: "0.03em",
	color: "#737373",
	margin: "20px 0 8px",
	"@media (prefers-color-scheme: dark)": { color: "#a3a3a3" },
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
	color: "#525252",
	margin: "8px 0 32px",
	"@media (prefers-color-scheme: dark)": { color: "#a3a3a3" },
});

/** Centered card used for the homepage's "tailored solutions for" audience-chip row. */
export const marketingAudienceCard = css({
	padding: 20,
	borderRadius: 12,
	border: "1px solid #e5e5e5",
	marginTop: 24,
	textAlign: "center",
	"@media (prefers-color-scheme: dark)": { borderColor: "#262626" },
});

/** Fixed-position flash toast, auto-dismissed with a CSS animation. */
export const toast = css({
	position: "fixed",
	bottom: 16,
	right: 16,
	padding: "10px 16px",
	borderRadius: 6,
	background: "#171717",
	color: "#ffffff",
	fontSize: "0.875rem",
	animation: "uptime-toast-fade 5s ease forwards",
	"@media (prefers-color-scheme: dark)": {
		background: "#e5e5e5",
		color: "#171717",
	},
	"@keyframes uptime-toast-fade": {
		"0%": { opacity: 1 },
		"85%": { opacity: 1 },
		"100%": { opacity: 0, visibility: "hidden" },
	},
});
