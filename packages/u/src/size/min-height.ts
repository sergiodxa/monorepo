/**
 * `@sdxc/u` sizes elements with logical properties by default; this utility
 * applies the physical `min-height` instead, for elements whose shape must
 * stay fixed regardless of writing-mode or direction (e.g. a chat bubble's
 * height relative to the screen). Prefer `u.minBs()` for the logical
 * default.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SizeValue } from "../internal/tokens";

import { utility } from "../internal/descriptor";
import { boxLength } from "../internal/tokens";

/**
 * Applies the physical `min-height` property. Prefer `u.minBs()`
 * (`min-block-size`) unless the element's sizing must track the physical
 * viewport axis regardless of writing-mode or direction.
 *
 * @example u.minHeight("full")
 * @example css({ minHeight: "100%" })
 */
export function minHeight<Node extends Element = Element>(value: SizeValue) {
	return utility<Node>(() => ({ minHeight: boxLength(value) }));
}
