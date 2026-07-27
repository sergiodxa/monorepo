/**
 * `@pkg/u` is logical-property-first everywhere else in the `size/` family
 * (`u.maxIs()`, `u.maxBs()`, ...), but some components size themselves
 * relative to the physical viewport/container axis on purpose — e.g. a chat
 * bubble whose `max-height` describes its shape relative to the screen, not
 * the block progression direction, and must not flip under a different
 * writing-mode or direction. This utility is a deliberate, narrow exception
 * scoped to that one use case: it sets the physical `max-height` property
 * directly. For the logical default, use `u.maxBs()` (`max-block-size`)
 * instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SizeValue } from "../internal/tokens";

import { utility } from "../internal/descriptor";
import { boxLength } from "../internal/tokens";

/**
 * Applies the physical `max-height` property. Prefer `u.maxBs()`
 * (`max-block-size`) unless the element's sizing is genuinely tied to the
 * physical viewport axis rather than the logical block axis.
 *
 * @example u.maxHeight("full")
 * @example css({ maxHeight: "100%" })
 */
export function maxHeight<Node extends Element = Element>(value: SizeValue) {
	return utility<Node>(() => ({ maxHeight: boxLength(value) }));
}
