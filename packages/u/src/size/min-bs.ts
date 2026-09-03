/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SizeValue } from "../internal/tokens.js";

import { utility } from "../internal/descriptor.js";
import { boxLength } from "../internal/tokens.js";

/**
 * Applies `min-block-size`.
 *
 * @example u.minBs(0)
 * @example css({ minBlockSize: "calc(var(--ui-spacing, 0.25rem) * 0)" })
 */
export function minBs<Node extends Element = Element>(value: SizeValue) {
	return utility<Node>(() => ({ minBlockSize: boxLength(value) }));
}
