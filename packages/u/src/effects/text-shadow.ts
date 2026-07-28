/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ColorValue } from "../types";

import { utility } from "../internal/descriptor";
import { color as colorToken, spacing } from "../internal/tokens";

export interface TextShadowOptions {
	/** The shadow's inline offset, from the spacing scale or a raw CSS length. Defaults to `0`. */
	x?: number | (string & {});
	/** The shadow's block offset, from the spacing scale or a raw CSS length. Defaults to `1`. */
	y?: number | (string & {});
	/** The shadow's blur radius, from the spacing scale or a raw CSS length. Defaults to `2`. */
	blur?: number | (string & {});
	/** The shadow's color, resolved with a default property of `border`. Defaults to a translucent black. */
	color?: ColorValue | (string & {});
}

/**
 * Applies `text-shadow`, which shadows the *glyphs* themselves. That is the
 * distinction from its two neighbours: `u.shadow()` shadows the element's box,
 * `u.dropShadow()` shadows its rendered shape, and this one traces the letter
 * forms.
 *
 * The real use is legibility for text sitting directly on an image or video,
 * where a soft dark shadow keeps the letters readable as the content behind
 * them changes. Treat it as the weaker option, though: it only rescues text
 * whose contrast is already borderline, and it does nothing measurable for a
 * contrast ratio. An actual scrim — a translucent overlay between the media and
 * the text — is the reliable fix, with a text shadow layered on top of it at
 * most.
 *
 * `text-shadow` accepts no spread radius and no `inset`, unlike `box-shadow`.
 *
 * @example u.textShadow()
 * @example css({ textShadow: "calc(var(--ui-spacing, 0.25rem) * 0) calc(var(--ui-spacing, 0.25rem) * 1) calc(var(--ui-spacing, 0.25rem) * 2) rgb(0 0 0 / 0.35)" })
 * @example u.textShadow({ y: "1px", blur: "3px", color: "brand" })
 * @example css({ textShadow: "calc(var(--ui-spacing, 0.25rem) * 0) 1px 3px var(--ui-brand-border)" })
 */
export function textShadow<Node extends Element = Element>(options: TextShadowOptions = {}) {
	let { x = 0, y = 1, blur = 2, color } = options;
	let resolved = color ? colorToken(color, "border") : "rgb(0 0 0 / 0.35)";
	return utility<Node>(() => ({
		textShadow: `${spacing(x)} ${spacing(y)} ${spacing(blur)} ${resolved}`,
	}));
}
