/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ColorValue } from "../types";

import { backdropFilterFunction } from "../internal/backdrop-filter";
import { color as colorToken, spacing } from "../internal/tokens";

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
 * Applies a `backdrop-filter: drop-shadow(...)`, shadowing the *rendered shape
 * of whatever shows through* the element rather than the element's own box —
 * the backdrop counterpart to `u.dropShadow()`. Its honest use is narrow:
 * because it shadows the backdrop rather than the host, it reads as a subtle
 * depth cue behind a translucent panel, not as an elevation shadow. Reach for
 * `u.shadow()` or `u.dropShadow()` for the element itself.
 *
 * Like every backdrop-filter utility this is an ungated primitive, so a call
 * site that respects `prefers-reduced-transparency` should wrap it in
 * `u.transparencySafe()`. It also has no visible effect unless the host's own
 * background is at least partly transparent — there is nothing showing through
 * an opaque element to shadow.
 *
 * Composes through the shared composite `backdrop-filter` declaration, so it
 * combines with every other backdrop utility instead of overwriting them.
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
