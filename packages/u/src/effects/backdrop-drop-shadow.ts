/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ColorValue } from "../types.js";

import { backdropFilterFunction } from "../internal/backdrop-filter.js";
import { color as colorToken, spacing } from "../internal/tokens.js";

export interface BackdropDropShadowOptions {
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
 * Shadows the rendered shape of whatever shows through the host — a subtle
 * depth cue behind a translucent panel, where `u.shadow()` and `u.dropShadow()`
 * cover the element's own box. `u.transparencySafe()` gates it.
 *
 * @example u.backdropDropShadow()
 * @example css({ "--ui-backdrop-drop-shadow": "calc(var(--ui-spacing, 0.25rem) * 0) calc(var(--ui-spacing, 0.25rem) * 1) calc(var(--ui-spacing, 0.25rem) * 2) rgb(0 0 0 / 0.15)", backdropFilter: "... drop-shadow(var(--ui-backdrop-drop-shadow, 0 0 0 transparent))" })
 * @example u.backdropDropShadow({ y: "2px", blur: "4px", color: "brand" })
 * @example css({ "--ui-backdrop-drop-shadow": "calc(var(--ui-spacing, 0.25rem) * 0) 2px 4px var(--ui-brand-border)", backdropFilter: "... drop-shadow(var(--ui-backdrop-drop-shadow, 0 0 0 transparent))" })
 */
export function backdropDropShadow<Node extends Element = Element>(
	options: BackdropDropShadowOptions = {},
) {
	let { x = 0, y = 1, blur = 2, color } = options;
	let resolved = color ? colorToken(color, "border") : "rgb(0 0 0 / 0.15)";
	return backdropFilterFunction<Node>({
		dropShadow: `${spacing(x)} ${spacing(y)} ${spacing(blur)} ${resolved}`,
	});
}
