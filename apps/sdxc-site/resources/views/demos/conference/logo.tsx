/**
 * Overprint's mark: a pink disc and a blue square printed over each other, violet where they
 * meet, beside the name in the condensed face. The mark is the conference's name drawn.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { css } from "remix/component";

import { BLUE, DISPLAY, PINK } from "~/resources/views/demos/conference/ink";

/**
 * Renders the mark and the name, linked to the top of the page.
 *
 * @returns The render function producing the logo.
 */
export default function ConferenceLogo() {
	return () => (
		<a
			href="#top"
			mix={css({
				display: "inline-flex",
				alignItems: "center",
				gap: "0.5rem",
				color: "inherit",
				textDecoration: "none",
			})}
		>
			<svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
				<circle cx="13" cy="13" r="11" fill={PINK} />
				<rect
					x="12"
					y="12"
					width="18"
					height="18"
					fill={BLUE}
					style="mix-blend-mode: var(--op-blend)"
				/>
			</svg>
			<span
				mix={css({
					fontFamily: DISPLAY,
					fontWeight: "900",
					fontSynthesis: "none",
					fontSize: "1.5rem",
					lineHeight: "1",
					textTransform: "uppercase",
					letterSpacing: "0.01em",
				})}
			>
				Overprint<span mix={css({ color: PINK })}>’27</span>
			</span>
		</a>
	);
}
