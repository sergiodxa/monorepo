/**
 * Shared `css()` mixins for the r3-uptime UI. Centralizes the small set of layout,
 * typography, and control styles reused across layouts and views so pages share one
 * visual language instead of repeating inline styles. Exists as the app's replacement
 * for the Tailwind utility classes the OLD APP used.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { css } from "remix/ui";

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
