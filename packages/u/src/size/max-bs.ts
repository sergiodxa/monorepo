/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SizeValue } from "../internal/tokens";

import { utility } from "../internal/descriptor";
import { boxLength } from "../internal/tokens";

/**
 * Applies `max-block-size`.
 *
 * @example u.maxBs("full")
 * @example css({ maxBlockSize: "100%" })
 */
export function maxBs<Node extends Element = Element>(value: SizeValue) {
	return utility<Node>(() => ({ maxBlockSize: boxLength(value) }));
}
