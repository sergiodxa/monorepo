/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SizeValue } from "../internal/tokens.js";

import { utility } from "../internal/descriptor.js";
import { boxLength } from "../internal/tokens.js";

/**
 * Applies `inline-size` — the logical width, which is the physical height
 * in a vertical writing mode.
 *
 * @example u.is("full")
 * @example css({ inlineSize: "100%" })
 */
export function is<Node extends Element = Element>(value: SizeValue) {
	return utility<Node>(() => ({ inlineSize: boxLength(value) }));
}
