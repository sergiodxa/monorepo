/**
 * The book's wordmark: its title in the serif, led by the measure bracket from the cover
 * drawn in the red ink, so the mark repeats the one figure the book is named for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack } from "@sdxc/u/layout";
import { font, nowrap, tracking } from "@sdxc/u/typography";

/**
 * Links home to the top of the page. The bracket is decorative, so the link's name is the
 * title alone.
 *
 * @returns The render function producing the linked mark.
 */
export default function BookLogo() {
	return () => (
		<a
			href="#top"
			mix={[
				hstack({ gap: 2, align: "center" }),
				fg("neutral.emphasis"),
				font("display"),
				tracking("tight"),
				nowrap(),
				raw({ fontSize: "1.3125rem", lineHeight: "1", textDecoration: "none" }),
			]}
		>
			<svg
				viewBox="0 0 24 16"
				width="24"
				height="16"
				aria-hidden="true"
				mix={[fg("brand"), raw({ flexShrink: "0" })]}
			>
				<path d="M1 2v12M23 2v12M1 8h22" stroke="currentColor" stroke-width="1.5" fill="none" />
			</svg>
			<span>
				<i>The</i> Measure
			</span>
		</a>
	);
}
