/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ColorValue } from "../types.js";

import { filterFunction } from "../internal/filter.js";
import { color as colorToken, spacing } from "../internal/tokens.js";

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
 * Applies `filter: drop-shadow(...)`, shadowing the element's rendered shape — a
 * PNG's alpha channel, an SVG icon's outline — with offsets and a blur radius.
 * Composes with every filter utility through the shared composite `filter`.
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
