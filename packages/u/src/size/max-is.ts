/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SizeValue } from "../internal/tokens";

import { utility } from "../internal/descriptor";
import { boxLength } from "../internal/tokens";

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
