/**
 * Reusable `remix/ui` `css()` mixins for the platform dashboard, replacing the
 * former Tailwind-CDN class strings. Every dashboard view composes these mixins via
 * the `mix` prop so the document no longer depends on an external Tailwind runtime.
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
 * JSX resolves an element to its concrete DOM type (`<select>`, or `<input>` with a
 * computed `type`). Only the compile-time type changes; the runtime value is identical.
 *
 * @param mixin - The `css()` mixin descriptor to re-type.
 * @returns The same mixin descriptor bound to the requested host node type.
 * @example
 * export const selectControl = mixFor<HTMLSelectElement>(control);
 */
export function mixFor<Node extends EventTarget>(
	mixin: CSSMixinDescriptor,
): MixinDescriptor<Node, CSSMixinDescriptor["args"], ElementProps> {
	return mixin as unknown as MixinDescriptor<Node, CSSMixinDescriptor["args"], ElementProps>;
}

// ---- Document shell ----

export const body = css({
	margin: "0",
	minHeight: "100vh",
	fontFamily: "system-ui, sans-serif",
	color: "#111827",
	background: "#f9fafb",
	lineHeight: "1.5",
});

export const nav = css({
	background: "#ffffff",
	borderBottom: "1px solid #e5e7eb",
	boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
});

export const navInner = css({
	maxWidth: "72rem",
	margin: "0 auto",
	padding: "1rem",
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
});

export const navLeft = css({ display: "flex", alignItems: "center", gap: "1rem" });

export const navTitle = css({ fontSize: "1.25rem", fontWeight: "700", margin: "0" });

export const main = css({ maxWidth: "72rem", margin: "0 auto", padding: "2rem 1rem" });

export const mainNarrow = css({ maxWidth: "32rem", margin: "0 auto", padding: "2rem 1rem" });

export const breadcrumb = css({
	color: "#4b5563",
	textDecoration: "none",
	"&:hover": { color: "#111827" },
});

export const breadcrumbSep = css({ color: "#9ca3af" });

export const breadcrumbCurrent = css({ fontWeight: "600" });

// ---- Banners ----

export const warningBanner = css({ background: "#fefce8", borderBottom: "1px solid #fde68a" });

export const warningBannerInner = css({
	maxWidth: "72rem",
	margin: "0 auto",
	padding: "0.75rem 1rem",
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
});

export const warningText = css({ color: "#854d0e", fontSize: "0.875rem", margin: "0" });

export const warningLink = css({
	color: "#854d0e",
	fontSize: "0.875rem",
	fontWeight: "500",
	textDecoration: "underline",
	"&:hover": { color: "#713f12" },
});

export const errorBanner = css({
	background: "#fef2f2",
	border: "1px solid #fecaca",
	color: "#b91c1c",
	padding: "0.75rem 1rem",
	borderRadius: "0.5rem",
	marginBottom: "1rem",
});

export const noticeRed = css({
	background: "#fef2f2",
	border: "1px solid #fecaca",
	borderRadius: "0.5rem",
	padding: "1rem",
	marginBottom: "1.5rem",
});

export const noticeRedTitle = css({ color: "#991b1b", fontWeight: "500", margin: "0" });

export const noticeRedText = css({ color: "#b91c1c", fontSize: "0.875rem", margin: "0.25rem 0 0" });

export const noticeGreen = css({
	background: "#f0fdf4",
	border: "1px solid #bbf7d0",
	borderRadius: "0.5rem",
	padding: "1rem",
	marginBottom: "1.5rem",
});

export const noticeGreenTitle = css({ color: "#166534", fontWeight: "500", margin: "0" });

export const noticeGreenText = css({
	color: "#15803d",
	fontSize: "0.875rem",
	margin: "0.25rem 0 0",
});

export const noticeYellow = css({
	background: "#fefce8",
	border: "1px solid #fde68a",
	borderRadius: "0.5rem",
	padding: "1rem",
});

export const noticeYellowStrong = css({ color: "#854d0e", fontSize: "0.875rem", margin: "0" });

// ---- Typography ----

export const pageTitle = css({ fontSize: "1.5rem", fontWeight: "700", margin: "0 0 1.5rem" });

export const sectionTitle = css({ fontSize: "1.125rem", fontWeight: "600", margin: "0 0 1rem" });

export const cardTitle = css({ fontWeight: "600", margin: "0 0 0.5rem" });

export const muted = css({ color: "#6b7280" });

export const mutedSmall = css({ color: "#6b7280", fontSize: "0.875rem" });

export const mutedXs = css({ color: "#6b7280", fontSize: "0.75rem", margin: "0.25rem 0 0" });

export const helpXs = css({ color: "#9ca3af", fontSize: "0.75rem", margin: "0.5rem 0 0" });

export const lead = css({ color: "#6b7280", margin: "0 0 1.5rem" });

export const bigNumber = css({ fontSize: "1.5rem", fontWeight: "700", margin: "0" });

export const hugeNumber = css({ fontSize: "1.875rem", fontWeight: "700", margin: "0 0 0.5rem" });

export const code = css({
	fontFamily: "ui-monospace, monospace",
	background: "#f3f4f6",
	padding: "0.125rem 0.5rem",
	borderRadius: "0.25rem",
});

export const codeBlock = css({
	display: "block",
	fontFamily: "ui-monospace, monospace",
	fontSize: "0.875rem",
	background: "#f3f4f6",
	padding: "0.25rem 0.5rem",
	borderRadius: "0.25rem",
	wordBreak: "break-all",
});

export const codePlain = css({ fontFamily: "ui-monospace, monospace" });

// ---- Layout helpers ----

export const header = css({
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	marginBottom: "1.5rem",
});

export const headerStart = css({
	display: "flex",
	justifyContent: "space-between",
	alignItems: "flex-start",
	marginBottom: "1.5rem",
});

export const actions = css({ display: "flex", gap: "0.5rem" });

export const stack = css({ display: "flex", flexDirection: "column", gap: "1.5rem" });

export const statsGrid = css({
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))",
	gap: "1rem",
	marginBottom: "2rem",
});

export const cardGrid = css({
	display: "grid",
	gridTemplateColumns: "repeat(auto-fill, minmax(16rem, 1fr))",
	gap: "1rem",
});

export const twoColGrid = css({
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(16rem, 1fr))",
	gap: "1.5rem",
	marginBottom: "2rem",
});

export const defList = css({
	display: "grid",
	gridTemplateColumns: "repeat(2, 1fr)",
	gap: "1rem",
	margin: "0",
});

export const dt = css({ color: "#6b7280", fontSize: "0.875rem", margin: "0" });

export const dd = css({ margin: "0.25rem 0 0" });

// ---- Cards & sections ----

export const card = css({
	background: "#ffffff",
	border: "1px solid #e5e7eb",
	borderRadius: "0.5rem",
	padding: "1rem",
});

export const section = css({
	background: "#ffffff",
	border: "1px solid #e5e7eb",
	borderRadius: "0.5rem",
	padding: "1.5rem",
	marginBottom: "1.5rem",
});

export const sectionTight = css({
	background: "#ffffff",
	border: "1px solid #e5e7eb",
	borderRadius: "0.5rem",
	padding: "1rem",
});

export const sectionBlue = css({
	background: "#eff6ff",
	border: "1px solid #bfdbfe",
	borderRadius: "0.5rem",
	padding: "1.5rem",
	marginBottom: "1.5rem",
});

export const sectionBlueTitle = css({ color: "#1e3a8a", fontWeight: "600", margin: "0 0 0.5rem" });

export const sectionBlueText = css({ color: "#1e40af", margin: "0 0 1rem" });

export const linkCard = css({
	display: "block",
	background: "#ffffff",
	border: "1px solid #e5e7eb",
	borderRadius: "0.5rem",
	padding: "1rem",
	textDecoration: "none",
	color: "inherit",
	"&:hover": { borderColor: "#3b82f6" },
});

export const listCard = css({
	border: "1px solid #e5e7eb",
	borderRadius: "0.5rem",
	padding: "1rem",
	"&:hover": { background: "#f9fafb" },
});

export const infoBox = css({ background: "#f9fafb", borderRadius: "0.5rem", padding: "1rem" });

// ---- Lists ----

export const list = css({ listStyle: "none", margin: "0", padding: "0" });

export const listSpaced = css({
	listStyle: "none",
	margin: "0",
	padding: "0",
	display: "flex",
	flexDirection: "column",
	gap: "1rem",
});

export const listRow = css({
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	fontSize: "0.875rem",
	padding: "0.5rem 0",
	borderBottom: "1px solid #e5e7eb",
	"&:last-child": { borderBottom: "0" },
});

export const listRowStart = css({
	display: "flex",
	alignItems: "flex-start",
	gap: "1rem",
	padding: "1rem 0",
	borderBottom: "1px solid #e5e7eb",
	"&:last-child": { borderBottom: "0" },
});

// ---- Table ----

export const tableWrap = css({
	background: "#ffffff",
	border: "1px solid #e5e7eb",
	borderRadius: "0.5rem",
	overflow: "hidden",
});

export const table = css({ width: "100%", borderCollapse: "collapse" });

export const theadRow = css({ background: "#f9fafb" });

export const th = css({
	textAlign: "left",
	padding: "0.75rem 1rem",
	fontSize: "0.875rem",
	fontWeight: "500",
	color: "#6b7280",
});

export const td = css({
	padding: "0.75rem 1rem",
	fontSize: "0.875rem",
	borderTop: "1px solid #e5e7eb",
});

export const rowLink = css({
	fontWeight: "500",
	color: "#2563eb",
	textDecoration: "none",
	"&:hover": { color: "#1d4ed8" },
});

// ---- Forms ----

export const form = css({
	background: "#ffffff",
	border: "1px solid #e5e7eb",
	borderRadius: "0.5rem",
	padding: "1.5rem",
	maxWidth: "32rem",
	display: "flex",
	flexDirection: "column",
	gap: "1rem",
});

export const field = css({ display: "flex", flexDirection: "column" });

export const label = css({
	display: "block",
	fontSize: "0.875rem",
	fontWeight: "500",
	color: "#374151",
	marginBottom: "0.25rem",
});

export const control = css({
	width: "100%",
	padding: "0.5rem 0.75rem",
	border: "1px solid #d1d5db",
	borderRadius: "0.5rem",
	font: "inherit",
});

/** {@link control} re-typed for `<select>` (see {@link mixFor}). */
export const selectControl = mixFor<HTMLSelectElement>(control);

export const textarea = css({
	width: "100%",
	padding: "0.5rem 0.75rem",
	border: "1px solid #d1d5db",
	borderRadius: "0.5rem",
	font: "inherit",
});

export const textareaMono = css({
	width: "100%",
	padding: "0.5rem 0.75rem",
	border: "1px solid #d1d5db",
	borderRadius: "0.5rem",
	fontFamily: "ui-monospace, monospace",
	fontSize: "0.875rem",
});

export const inlineRow = css({ display: "flex", gap: "0.5rem", alignItems: "center" });

export const inlineForm = css({ display: "flex", gap: "0.5rem", marginTop: "1rem" });

export const grow = css({ flex: "1" });

export const colorSwatch = css({
	width: "3rem",
	height: "2.5rem",
	borderRadius: "0.5rem",
	border: "1px solid #d1d5db",
	cursor: "pointer",
	padding: "0",
});

export const checkboxLabel = css({
	display: "flex",
	alignItems: "center",
	gap: "0.5rem",
	fontSize: "0.875rem",
});

// ---- Buttons ----

export const button = css({
	display: "inline-block",
	background: "#2563eb",
	color: "#ffffff",
	border: "0",
	padding: "0.5rem 1rem",
	borderRadius: "0.5rem",
	cursor: "pointer",
	textDecoration: "none",
	font: "inherit",
	textAlign: "center",
	"&:hover": { background: "#1d4ed8" },
});

export const buttonBlock = css({ width: "100%" });

export const buttonDark = css({ background: "#111827", "&:hover": { background: "#1f2937" } });

export const linkPlain = css({
	background: "none",
	border: "0",
	padding: "0",
	font: "inherit",
	cursor: "pointer",
	textDecoration: "none",
});

export const linkBlue = css({
	color: "#2563eb",
	textDecoration: "none",
	background: "none",
	border: "0",
	padding: "0",
	font: "inherit",
	cursor: "pointer",
	"&:hover": { color: "#1d4ed8" },
});

export const linkBlueSm = css({
	color: "#2563eb",
	fontSize: "0.875rem",
	textDecoration: "none",
	background: "none",
	border: "0",
	padding: "0",
	font: "inherit",
	cursor: "pointer",
	"&:hover": { color: "#1d4ed8" },
});

export const linkRed = css({
	color: "#dc2626",
	textDecoration: "none",
	background: "none",
	border: "0",
	padding: "0",
	font: "inherit",
	cursor: "pointer",
	"&:hover": { color: "#991b1b" },
});

export const linkRedSm = css({
	color: "#dc2626",
	fontSize: "0.875rem",
	textDecoration: "none",
	background: "none",
	border: "0",
	padding: "0",
	font: "inherit",
	cursor: "pointer",
	"&:hover": { color: "#991b1b" },
});

export const inlineFormEl = css({ display: "inline" });

// ---- Badges ----

export const badge = css({
	display: "inline-block",
	padding: "0.25rem 0.5rem",
	fontSize: "0.75rem",
	borderRadius: "0.25rem",
});

export const badgePill = css({
	display: "inline-block",
	padding: "0.125rem 0.5rem",
	fontSize: "0.75rem",
	fontWeight: "500",
	borderRadius: "9999px",
});

export const badgeGreen = css({ background: "#dcfce7", color: "#166534" });
export const badgeGray = css({ background: "#f3f4f6", color: "#1f2937" });
export const badgeGrayMuted = css({ background: "#f3f4f6", color: "#4b5563" });
export const badgeBlue = css({ background: "#dbeafe", color: "#1e40af" });
export const badgePurple = css({ background: "#f3e8ff", color: "#6b21a8" });
export const badgeOrange = css({ background: "#ffedd5", color: "#9a3412" });
export const badgeYellow = css({ background: "#fef9c3", color: "#854d0e" });
export const badgeRed = css({ background: "#fee2e2", color: "#991b1b" });

// ---- Misc ----

export const verified = css({ color: "#16a34a", marginLeft: "0.25rem" });

export const deviceIcon = css({
	width: "2rem",
	height: "2rem",
	color: "#9ca3af",
	flexShrink: "0",
});

export const sessionInfo = css({ flex: "1", minWidth: "0" });

export const sessionMeta = css({ display: "flex", alignItems: "center", gap: "0.5rem" });

export const sessionMetaWrap = css({
	display: "flex",
	alignItems: "center",
	gap: "0.5rem",
	flexWrap: "wrap",
});

export const flexShrink = css({ flexShrink: "0" });

export const secretBox = css({
	background: "#ffffff",
	border: "1px solid #e5e7eb",
	borderRadius: "0.5rem",
	padding: "1rem",
	fontFamily: "ui-monospace, monospace",
	fontSize: "0.875rem",
	wordBreak: "break-all",
	userSelect: "all",
});

export const dnsBox = css({
	marginTop: "0.5rem",
	fontFamily: "ui-monospace, monospace",
	fontSize: "0.75rem",
	background: "#ffffff",
	padding: "0.5rem",
	borderRadius: "0.25rem",
	border: "1px solid #e5e7eb",
});

export const validationBox = css({
	marginTop: "0.5rem",
	padding: "0.75rem",
	background: "#fefce8",
	borderRadius: "0.25rem",
	fontSize: "0.875rem",
});

export const orderedList = css({
	margin: "0",
	paddingLeft: "1.25rem",
	color: "#1e40af",
	fontSize: "0.875rem",
	display: "flex",
	flexDirection: "column",
	gap: "0.25rem",
});

export const pricingRow = css({
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	marginBottom: "0.5rem",
});

export const usageBox = css({
	marginTop: "1rem",
	paddingTop: "1rem",
	borderTop: "1px solid #e5e7eb",
});

/** Universal reset injected once (box-sizing only; everything else is a mixin). */
export const RESET_CSS = "*,*::before,*::after{box-sizing:border-box}";
