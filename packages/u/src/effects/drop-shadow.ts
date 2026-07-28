/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ColorValue } from "../types";

import { filterFunction } from "../internal/filter";
import { color as colorToken, spacing } from "../internal/tokens";

export interface DropShadowOptions {
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
 * Applies a `filter: drop-shadow(...)`, which shadows an element's *rendered
 * shape* rather than its box — so it follows the alpha channel of a
 * transparent PNG, the outline of an inline SVG icon, or a clipped shape,
 * where `u.shadow()`'s `box-shadow` would draw a rectangle around the whole
 * element. Composes through the shared composite `filter` declaration, so it
 * combines with every other filter utility.
 *
 * Note `drop-shadow()` accepts no spread radius and no `inset`, unlike
 * `box-shadow`.
 *
 * @example u.dropShadow()
 * @example css({ "--ui-filter-drop-shadow": "calc(var(--ui-spacing, 0.25rem) * 0) calc(var(--ui-spacing, 0.25rem) * 1) calc(var(--ui-spacing, 0.25rem) * 2) rgb(0 0 0 / 0.15)", filter: "... drop-shadow(var(--ui-filter-drop-shadow, 0 0 0 transparent))" })
 * @example u.dropShadow({ y: "2px", blur: "4px", color: "brand" })
 * @example css({ "--ui-filter-drop-shadow": "calc(var(--ui-spacing, 0.25rem) * 0) 2px 4px var(--ui-brand-border)", filter: "... drop-shadow(var(--ui-filter-drop-shadow, 0 0 0 transparent))" })
 */
export function dropShadow<Node extends Element = Element>(options: DropShadowOptions = {}) {
	let { x = 0, y = 1, blur = 2, color } = options;
	let resolved = color ? colorToken(color, "border") : "rgb(0 0 0 / 0.15)";
	return filterFunction<Node>({
		dropShadow: `${spacing(x)} ${spacing(y)} ${spacing(blur)} ${resolved}`,
	});
}
