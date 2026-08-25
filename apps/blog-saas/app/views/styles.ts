/**
 * The dashboard's shared style mixins: a small set of reusable `remix/ui` `css()`
 * descriptors (body, buttons, form controls, tables, etc.) plus the global CSS reset,
 * kept in one place so the plain-HTML views stay consistent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSMixinDescriptor, ElementProps, MixinDescriptor } from "remix/ui";

import { css } from "remix/ui";

export const body = css({
	fontFamily: "system-ui, sans-serif",
	maxWidth: "48rem",
	margin: "2rem auto",
	padding: "0 1rem",
	color: "#111827",
	lineHeight: "1.5",
});
export const table = css({ width: "100%", borderCollapse: "collapse" });
export const cell = css({
	textAlign: "left",
	padding: "0.5rem",
	borderBottom: "1px solid #e5e7eb",
});
export const label = css({ display: "block", margin: "0.75rem 0 0.25rem", fontWeight: "600" });
export const control = css({
	width: "100%",
	padding: "0.5rem",
	border: "1px solid #d1d5db",
	borderRadius: "0.375rem",
	font: "inherit",
});
export const button = css({
	display: "inline-block",
	background: "#2563eb",
	color: "#fff",
	border: "0",
	padding: "0.5rem 1rem",
	borderRadius: "0.375rem",
	cursor: "pointer",
	textDecoration: "none",
	font: "inherit",
});
export const buttonDanger = css({ background: "#dc2626" });
export const muted = css({ color: "#6b7280" });

/**
 * `<select>` variant of {@link control}. `@cloudflare/workers-types` shadows the
 * global `Element` with HTMLRewriter's, so a select's `mix` prop needs this mixin
 * re-typed for `HTMLSelectElement`; the runtime value is identical.
 */
export const selectControl = control as unknown as MixinDescriptor<
	HTMLSelectElement,
	CSSMixinDescriptor["args"],
	ElementProps
>;

/** Universal reset injected once. */
export const RESET_CSS = "*,*::before,*::after{box-sizing:border-box}";
