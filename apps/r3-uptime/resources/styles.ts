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
