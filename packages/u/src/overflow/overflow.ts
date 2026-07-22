/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { if as ifUtility } from "../general/if";
import { compose, utility } from "../internal/descriptor";

import { overflowX } from "./overflow-x";
import { overflowY } from "./overflow-y";

export type OverflowValue = "visible" | "hidden" | "auto" | "clip" | "scroll";

/**
 * Applies `overflow`, defaulting to `"hidden"`. Called with an axis object
 * instead of a bare value, it composes `u.overflowX()`/`u.overflowY()` for
 * whichever of `x`/`y` is given, leaving the other axis untouched.
 *
 * @example u.overflow()
 * @example css({ overflow: "hidden" })
 * @example u.overflow({ x: "auto" })
 * @example css({ overflowX: "auto" })
 */
export function overflow<Node extends Element = Element>(
	value: OverflowValue | { x?: OverflowValue; y?: OverflowValue } = "hidden",
) {
	if (typeof value === "string") return utility<Node>(() => ({ overflow: value }));
	return compose<Node>(
		[
			ifUtility(value.x !== undefined, overflowX<Node>(value.x as OverflowValue)),
			ifUtility(value.y !== undefined, overflowY<Node>(value.y as OverflowValue)),
		],
		(styles) => styles,
	);
}
