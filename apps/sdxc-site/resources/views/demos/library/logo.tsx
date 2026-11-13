/**
 * Plumb's marks: a plumb bob hanging from its line, drawn in the neon accent, beside the
 * lowercase mono wordmark, so the logo reads as a tool for checking that something is true.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";

/**
 * The bob alone, in the brand ink: a line from the top edge and a faceted weight whose
 * point marks true vertical. Sized in `em`, so it scales with the text around it.
 *
 * @returns The render function producing the glyph.
 */
export function PlumbGlyph() {
	return () => (
		<svg
			viewBox="0 0 24 24"
			aria-hidden="true"
			mix={[
				raw({
					inlineSize: "1.25em",
					blockSize: "1.25em",
					flexShrink: "0",
					color: "var(--ui-brand-fg)",
				}),
			]}
		>
			<path d="M12 1v7" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
			<path d="M7.5 9.5h9l-1.5 6L12 23l-3-7.5z" fill="currentColor" />
			<path d="M7.5 9.5h9" stroke="var(--ui-bg)" stroke-width="1" />
		</svg>
	);
}

/**
 * The full logo: the bob and the wordmark set in the page's mono at the header's size.
 *
 * @returns The render function producing the logo.
 */
export function PlumbLogo() {
	return () => (
		<span
			mix={[
				raw({
					display: "inline-flex",
					alignItems: "center",
					gap: "0.375rem",
					fontFamily: "var(--ui-font-mono)",
					fontSize: "1.125rem",
					fontWeight: "700",
					letterSpacing: "-0.02em",
					color: "var(--ui-neutral-fg-emphasis)",
				}),
			]}
		>
			<PlumbGlyph />
			plumb
		</span>
	);
}
