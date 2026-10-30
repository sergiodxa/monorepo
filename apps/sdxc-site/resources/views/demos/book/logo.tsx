/**
 * The book's mark: a measure bracket over a baseline, beside the title set in the display
 * face. The header and footer both draw it, so the page opens and closes on the same name.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { hstack } from "@sdxc/u/layout";
import { font, nowrap, text, tracking } from "@sdxc/u/typography";

/**
 * Links home to the top of the page. The glyph is decorative, so the link's name is the
 * title alone.
 *
 * @returns The render function producing the linked mark.
 */
export default function BookLogo() {
	return () => (
		<a
			href="#top"
			mix={[
				hstack({ gap: 2.5, align: "center" }),
				fg("neutral.emphasis"),
				font("display"),
				text("xl"),
				tracking("tight"),
				nowrap(),
			]}
		>
			<svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">
				<rect width="28" height="28" rx="7" fill="var(--ui-brand-bg-solid)" />
				<path
					d="M7 9v5M21 9v5M7 11.5h14"
					stroke="white"
					stroke-width="1.75"
					stroke-linecap="round"
					fill="none"
				/>
				<path d="M7 19h14" stroke="white" stroke-opacity="0.55" stroke-width="1.75" />
			</svg>
			The Measure
		</a>
	);
}
