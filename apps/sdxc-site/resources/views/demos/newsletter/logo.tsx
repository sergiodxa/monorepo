/**
 * Undercurrent's wordmark: the name in the page's sans beside a small mark, a street line
 * with two currents running under it, drawn in the ink blue so the mark says what the
 * letters are about.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack } from "@sdxc/u/layout";
import { nowrap } from "@sdxc/u/typography";

/** The street and the two currents under it, as one decorative glyph. */
export function UndercurrentMark() {
	return () => (
		<svg
			viewBox="0 0 24 18"
			width="24"
			height="18"
			aria-hidden="true"
			mix={[fg("brand"), raw({ flexShrink: "0" })]}
		>
			<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
				<path d="M2 3h20" />
				<path d="M2 10c3-2.5 6-2.5 9 0s6 2.5 9 0" opacity="0.85" />
				<path d="M4 15.5c2.6-2 5.3-2 8 0s5.3 2 8 0" opacity="0.55" />
			</g>
		</svg>
	);
}

/**
 * Links home to the top of the page. The mark is decorative, so the link's name is the
 * title alone.
 *
 * @returns The render function producing the linked mark.
 */
export default function UndercurrentLogo() {
	return () => (
		<a
			href="#top"
			mix={[
				hstack({ gap: 2, align: "center" }),
				fg("neutral.emphasis"),
				nowrap(),
				raw({
					fontSize: "1.125rem",
					fontWeight: "600",
					letterSpacing: "0.01em",
					lineHeight: "1",
					textDecoration: "none",
				}),
			]}
		>
			<UndercurrentMark />
			Undercurrent
		</a>
	);
}
