/**
 * Margin's wordmark: a notebook corner with its red margin line and two blue rules, the
 * last one run over with the highlighter, beside the name in the page's sans. The mark
 * draws the product's one idea, a ruled page with a line picked out.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";

/**
 * Links to the top of the page. The mark is decorative, so the link's name is the word.
 *
 * @returns The render function producing the linked mark.
 */
export default function MarginLogo() {
	return () => (
		<a
			href="#top"
			mix={[
				raw({
					display: "inline-flex",
					alignItems: "center",
					gap: "0.5rem",
					color: "var(--ui-neutral-fg-emphasis)",
					fontSize: "1.25rem",
					fontWeight: "650",
					letterSpacing: "-0.02em",
					lineHeight: "1",
					textDecoration: "none",
					whiteSpace: "nowrap",
				}),
			]}
		>
			<svg
				viewBox="0 0 24 24"
				width="24"
				height="24"
				aria-hidden="true"
				mix={[raw({ flexShrink: "0" })]}
			>
				<rect
					x="2.5"
					y="2.5"
					width="19"
					height="19"
					rx="2.5"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
				/>
				<rect x="9" y="13.5" width="10.5" height="4" rx="1" fill="var(--margin-highlighter)" />
				<path d="M7.5 3v18" stroke="var(--margin-red-pen)" stroke-width="1.5" />
				<path
					d="M10 9.5h9M10 15.5h9"
					stroke="var(--ui-brand-fg)"
					stroke-width="1.5"
					stroke-linecap="round"
				/>
			</svg>
			<span>Margin</span>
		</a>
	);
}
