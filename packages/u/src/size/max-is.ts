/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SizeValue } from "../internal/tokens.js";

import { utility } from "../internal/descriptor.js";
import { boxLength } from "../internal/tokens.js";

/**
 * Applies `max-inline-size`.
 *
 * @example u.maxIs("60ch")
 * @example css({ maxInlineSize: "60ch" })
 * @example u.maxIs("full")
 * @example css({ maxInlineSize: "100%" })
 */
export function maxIs<Node extends Element = Element>(value: SizeValue) {
	return utility<Node>(() => ({ maxInlineSize: boxLength(value) }));
}
