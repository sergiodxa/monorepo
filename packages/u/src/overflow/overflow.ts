/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { if as ifUtility } from "../general/if.js";
import { compose, utility } from "../internal/descriptor.js";

import { overflowBlock } from "./overflow-block.js";
import { overflowInline } from "./overflow-inline.js";
import { overflowX } from "./overflow-x.js";
import { overflowY } from "./overflow-y.js";

export type OverflowValue = "visible" | "hidden" | "auto" | "clip" | "scroll";

/**
 * Applies `overflow`, defaulting to `"hidden"`. An axis object sets only the
 * axes it names and leaves the rest untouched; prefer its `inline`/`block`
 * keys over `x`/`y` to stay correct under RTL and vertical writing modes.
 *
 * @example u.overflow()
 * @example css({ overflow: "hidden" })
 * @example u.overflow({ x: "auto" })
 * @example css({ overflowX: "auto" })
 * @example u.overflow({ inline: "auto" })
 * @example css({ overflowInline: "auto" })
 */
export function overflow<Node extends Element = Element>(
	value:
		| OverflowValue
		| {
				x?: OverflowValue;
				y?: OverflowValue;
				inline?: OverflowValue;
				block?: OverflowValue;
		  } = "hidden",
) {
	if (typeof value === "string") return utility<Node>(() => ({ overflow: value }));
	return compose<Node>(
		[
			ifUtility(value.x !== undefined, overflowX<Node>(value.x as OverflowValue)),
			ifUtility(value.y !== undefined, overflowY<Node>(value.y as OverflowValue)),
			ifUtility(value.inline !== undefined, overflowInline<Node>(value.inline as OverflowValue)),
			ifUtility(value.block !== undefined, overflowBlock<Node>(value.block as OverflowValue)),
		],
		(styles) => styles,
	);
}
