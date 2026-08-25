/**
 * The physical `height` property keeps an element's size tied to the
 * viewport axis across writing-modes and directions, matching the
 * screen-relative shape of something like a chat bubble. Reach for
 * `u.bs()` (`block-size`) for content that should track the logical
 * block axis.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SizeValue } from "../internal/tokens";

import { utility } from "../internal/descriptor";
import { boxLength } from "../internal/tokens";

/**
 * Applies the physical `height` property, keeping element size tied to
 * the viewport axis across writing-modes and directions. Prefer `u.bs()`
 * (`block-size`) for content that should track the logical block axis.
 *
 * @example u.height("full")
 * @example css({ height: "100%" })
 */
export function height<Node extends Element = Element>(value: SizeValue) {
	return utility<Node>(() => ({ height: boxLength(value) }));
}
