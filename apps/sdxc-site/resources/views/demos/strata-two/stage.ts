/**
 * The dark product stage Strata's hero, scenes and sound board stand on in either colour
 * scheme. Paired with the `dark` class, it re-points the page tokens that the demo theme
 * resolved for light on the page root, so text and hairlines read on black.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";

/** The class that switches a subtree's semantic tokens to their dark values. */
export const STAGE_CLASS = "dark";

/**
 * The stage's floor and ink: the darkest aluminium step, white-at-10% hairlines, and the
 * dark emphasis colour for text.
 *
 * @returns One mixin for the element that carries {@link STAGE_CLASS}.
 */
export function stage() {
	return raw({
		"--ui-fg": "var(--ui-neutral-fg-emphasis)",
		"--ui-landing-hairline": "color-mix(in oklch, white 11%, transparent)",
		"--ui-surface-raised": "var(--ui-color-neutral-900)",
		backgroundColor: "var(--ui-color-neutral-950)",
		color: "var(--ui-neutral-fg-emphasis)",
	});
}
