/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SizeValue } from "../internal/tokens";

import { utility } from "../internal/descriptor";
import { boxLength } from "../internal/tokens";

/**
 * Applies `min-block-size`.
 *
 * @example u.minBs(0)
 * @example css({ minBlockSize: "calc(var(--ui-spacing, 0.25rem) * 0)" })
 */
export function minBs<Node extends Element = Element>(value: SizeValue) {
	return utility<Node>(() => ({ minBlockSize: boxLength(value) }));
}
