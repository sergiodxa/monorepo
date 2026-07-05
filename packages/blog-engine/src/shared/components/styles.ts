/**
 * Central stylesheet for the engine's views: reusable `remix/ui` `css()` mixins for
 * the public site and CMS, the raw reset/content rule-sets, and the {@link mixFor}
 * helper for re-typing a mixin to a concrete host element.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSMixinDescriptor, ElementProps, MixinDescriptor } from "remix/ui";

import { css } from "remix/ui";

/**
 * Reusable `remix/ui` `css()` mixins shared across the engine's views. Public-site
 * mixins reference the theme's `--ui-*`/`--blog-*` tokens (set by `renderThemeStyle`
 * in a `:root` block); the CMS admin mixins use a fixed palette.
 */

// ---- Public site ----

export const container = css({
	maxWidth: "var(--blog-measure)",
	margin: "0 auto",
	padding: "calc(var(--blog-spacing) * 2) var(--blog-spacing)",
});

export const body = css({
	margin: "0",
	background: "var(--ui-bg)",
	color: "var(--ui-fg)",
	fontFamily: "var(--blog-font-body)",
	fontSize: "var(--blog-font-size)",
	lineHeight: "1.6",
});

export const siteHeader = css({
	display: "flex",
	flexWrap: "wrap",
	gap: "var(--blog-spacing)",
	alignItems: "baseline",
	justifyContent: "space-between",
	borderBottom: "1px solid var(--ui-border)",
});

export const siteTitle = css({
	fontWeight: "700",
	fontSize: "1.25rem",
	color: "var(--ui-fg)",
	textDecoration: "none",
});

export const navLink = css({ marginLeft: "var(--blog-spacing)", color: "var(--ui-accent)" });

export const footer = css({
	marginTop: "calc(var(--blog-spacing) * 3)",
	paddingTop: "var(--blog-spacing)",
	borderTop: "1px solid var(--ui-border)",
	color: "var(--ui-muted)",
	fontSize: "0.875rem",
});

export const postList = css({ listStyle: "none", padding: "0" });
export const postListItem = css({
	padding: "var(--blog-spacing) 0",
	borderBottom: "1px solid var(--ui-border)",
});
export const meta = css({ color: "var(--ui-muted)", fontSize: "0.875rem" });
export const tag = css({
	display: "inline-block",
	padding: "0.1em 0.5em",
	borderRadius: "var(--blog-radius)",
	background: "var(--ui-surface)",
	fontSize: "0.85em",
});

// ---- CMS admin (fixed palette) ----

export const cmsShell = css({
	display: "grid",
	gridTemplateColumns: "220px 1fr",
	minHeight: "100vh",
});
export const cmsBody = css({
	margin: "0",
	fontFamily: "system-ui, sans-serif",
	color: "#111827",
	background: "#f9fafb",
	lineHeight: "1.5",
});
export const cmsSide = css({ background: "#111827", color: "#e5e7eb", padding: "1rem" });
export const cmsSideLink = css({
	display: "block",
	color: "#d1d5db",
	textDecoration: "none",
	padding: "0.4rem 0.5rem",
	borderRadius: "0.375rem",
	"&:hover": { background: "#1f2937", color: "#fff" },
});
export const cmsMain = css({ padding: "1.5rem 2rem", maxWidth: "60rem" });
export const cmsUser = css({ marginTop: "1.5rem", fontSize: "0.8rem", color: "#9ca3af" });

export const table = css({ width: "100%", borderCollapse: "collapse" });
export const cell = css({
	textAlign: "left",
	padding: "0.5rem",
	borderBottom: "1px solid #e5e7eb",
});
export const label = css({
	display: "block",
	margin: "0.75rem 0 0.25rem",
	fontWeight: "600",
	fontSize: "0.875rem",
});
export const control = css({
	width: "100%",
	padding: "0.5rem",
	border: "1px solid #d1d5db",
	borderRadius: "0.375rem",
	font: "inherit",
});
/**
 * Re-types a `css()` mixin for a specific host element. `css()` binds its mixin to
 * the global `Element`, but `@cloudflare/workers-types` shadows `Element` with
 * HTMLRewriter's (whose `remove()` returns `Element`), so a plain `Element` mixin is
 * not assignable to the `mix` prop once JSX resolves an element to its concrete DOM
 * type (`<select>`, or `<input>` with a computed `type`). Only the compile-time type
 * changes; the runtime value is identical.
 * @param mixin - The `css()` mixin to re-type.
 * @returns The same mixin value, typed for the given host element.
 */
export function mixFor<Node extends EventTarget>(
	mixin: CSSMixinDescriptor,
): MixinDescriptor<Node, CSSMixinDescriptor["args"], ElementProps> {
	return mixin as unknown as MixinDescriptor<Node, CSSMixinDescriptor["args"], ElementProps>;
}

/** {@link control} re-typed for `<select>` (see {@link mixFor}). */
export const selectControl = mixFor<HTMLSelectElement>(control);
export const textarea = css({
	width: "100%",
	padding: "0.5rem",
	border: "1px solid #d1d5db",
	borderRadius: "0.375rem",
	font: "inherit",
	minHeight: "12rem",
	fontFamily: "ui-monospace, monospace",
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
export const buttonSecondary = css({ background: "#6b7280" });
export const buttonDanger = css({ background: "#dc2626" });
export const notice = css({
	background: "#fef3c7",
	border: "1px solid #fde68a",
	padding: "0.75rem",
	borderRadius: "0.375rem",
	marginBottom: "1rem",
});
export const help = css({ color: "#6b7280", fontSize: "0.8rem", margin: "0.25rem 0 0" });

// ---- Auth pages ----

export const authBody = css({
	fontFamily: "system-ui, sans-serif",
	maxWidth: "24rem",
	margin: "6rem auto",
	padding: "0 1rem",
	textAlign: "center",
});
export const errorText = css({ color: "#b91c1c", marginBottom: "1rem" });

/** Universal reset injected once (box-sizing only; everything else is a mixin). */
export const RESET_CSS = "*,*::before,*::after{box-sizing:border-box}";

/**
 * Typography defaults for content-flow elements the engine cannot reach with a
 * mixin — chiefly the markdown output rendered by `MarkdownView`. Chrome and
 * component styling use `css()` mixins above; only content typography is a rule set.
 */
export const CONTENT_CSS = [
	"a{color:var(--ui-accent)}a:hover{color:var(--ui-accent-hover)}",
	"h1,h2,h3,h4{font-family:var(--blog-font-heading);line-height:1.2}",
	"img{max-width:100%;height:auto}",
	"pre{overflow-x:auto;padding:var(--blog-spacing);border-radius:var(--blog-radius);background:var(--ui-surface)}",
].join("");
