/**
 * `@pkg/u` is logical-property-first everywhere else in the `size/` family
 * (`u.is()`, `u.bs()`, ...), but some components size themselves relative to
 * the physical viewport/container axis on purpose — e.g. a chat bubble whose
 * `height` describes its shape relative to the screen, not the block
 * progression direction, and must not flip under a different writing-mode
 * or direction. This utility is a deliberate, narrow exception scoped to
 * that one use case: it sets the physical `height` property directly. For
 * the logical default, use `u.bs()` (`block-size`) instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SizeValue } from "../internal/tokens";

import { utility } from "../internal/descriptor";
import { boxLength } from "../internal/tokens";

/**
 * Applies the physical `height` property. Prefer `u.bs()` (`block-size`)
 * unless the element's sizing is genuinely tied to the physical viewport
 * axis rather than the logical block axis.
 *
 * @example u.height("full")
 * @example css({ height: "100%" })
 */
export function height<Node extends Element = Element>(value: SizeValue) {
	return utility<Node>(() => ({ height: boxLength(value) }));
}
