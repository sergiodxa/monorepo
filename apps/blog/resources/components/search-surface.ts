/**
 * The glass the search dialog's surfaces are cut from: the box's pill and the results card
 * under it float apart over the page, each a frosted panel with a hairline edge, so the two
 * read as one instrument in either theme.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, border, colorMix, fg } from "@sdxc/u/color";
import { backdropBlur, shadow } from "@sdxc/u/effects";
import { media } from "@sdxc/u/responsive";

/**
 * The panel's own text color at low strength: a hairline that stays equally faint against
 * the panel in light and dark themes.
 */
export const SEARCH_HAIRLINE = colorMix(
	"oklab",
	{ color: "var(--ui-neutral-fg-emphasis)", weight: 10 },
	"transparent",
);

/**
 * A frosted panel. A reader who asks for reduced transparency gets the solid panel color,
 * so text over a busy page stays legible.
 */
export function searchSurface() {
	return [
		bg("neutral.tint"),
		fg("neutral.emphasis"),
		border({ color: SEARCH_HAIRLINE, width: 1 }),
		shadow("xl"),
		media("(prefers-reduced-transparency: no-preference)", [
			bg(colorMix("oklab", { color: "var(--ui-neutral-bg-tint)", weight: 88 }, "transparent")),
			backdropBlur("xl"),
		]),
	];
}
