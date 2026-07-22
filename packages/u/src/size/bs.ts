/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SizeValue } from "../internal/tokens";

import { utility } from "../internal/descriptor";
import { boxLength } from "../internal/tokens";

/**
 * Applies `block-size` — the logical height, which is the physical width in
 * a vertical writing mode.
 *
 * @example u.bs("full")
 * @example css({ blockSize: "100%" })
 */
export function bs<Node extends Element = Element>(value: SizeValue) {
	return utility<Node>(() => ({ blockSize: boxLength(value) }));
}
