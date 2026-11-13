/**
 * Quoin's wordmark: the name in the Didone beside a quoin, the wedge a printer drives into
 * the chase to lock a page of type tight, drawn as a square cut on its diagonal.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";

import { DIDONE } from "~/resources/views/demos/studio/type";

/**
 * Renders the mark and the name in `currentColor`, so the header and the footer each set
 * it in their own ink.
 *
 * @returns The render function producing the wordmark.
 */
export default function StudioLogo() {
	return () => (
		<span
			mix={[
				raw({
					display: "inline-flex",
					alignItems: "center",
					gap: "0.5rem",
					fontFamily: DIDONE,
					fontSize: "1.625rem",
					lineHeight: "1",
					letterSpacing: "-0.01em",
					color: "var(--ui-neutral-fg-emphasis)",
				}),
			]}
		>
			<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
				<rect
					x="1"
					y="1"
					width="18"
					height="18"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
				/>
				<path d="M1 19 19 1V19Z" fill="currentColor" />
			</svg>
			Quoin
		</span>
	);
}
