/**
 * A deliberate exception to the logical-property-first `size/` family: sets
 * `max-height` on the physical viewport axis for components, such as a chat
 * bubble, that must size against the screen regardless of writing-mode.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SizeValue } from "../internal/tokens.js";

import { utility } from "../internal/descriptor.js";
import { boxLength } from "../internal/tokens.js";

/**
 * Applies the physical `max-height` property, for components whose sizing
 * tracks the physical viewport axis. Use `u.maxBs()` (`max-block-size`) for
 * the logical block-axis default.
 *
 * @example u.maxHeight("full")
 * @example css({ maxHeight: "100%" })
 */
export function maxHeight<Node extends Element = Element>(value: SizeValue) {
	return utility<Node>(() => ({ maxHeight: boxLength(value) }));
}
