/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SizeValue } from "../internal/tokens.js";

import { utility } from "../internal/descriptor.js";
import { boxLength } from "../internal/tokens.js";

/**
 * Applies `max-block-size`.
 *
 * @example u.maxBs("full")
 * @example css({ maxBlockSize: "100%" })
 */
export function maxBs<Node extends Element = Element>(value: SizeValue) {
	return utility<Node>(() => ({ maxBlockSize: boxLength(value) }));
}
