/**
 * The physical-axis exception in an otherwise logical-property-first `size/`
 * family: a few components size themselves against the physical viewport or
 * container axis on purpose — a chat bubble whose width describes its shape
 * relative to the screen holds that shape under any writing-mode or
 * direction. `u.is()` (`inline-size`) covers the logical default.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SizeValue } from "../internal/tokens";

import { utility } from "../internal/descriptor";
import { boxLength } from "../internal/tokens";

/**
 * Applies the physical `width` property, for an element whose sizing is tied
 * to the physical viewport axis; `u.is()` (`inline-size`) covers sizing along
 * the logical inline axis.
 *
 * @example u.width("full")
 * @example css({ width: "100%" })
 */
export function width<Node extends Element = Element>(value: SizeValue) {
	return utility<Node>(() => ({ width: boxLength(value) }));
}
