/**
 * `@pkg/u` is logical-property-first everywhere else in the `size/` family
 * (`u.minIs()`, `u.minBs()`, ...), but some components size themselves
 * relative to the physical viewport/container axis on purpose — e.g. a chat
 * bubble whose `min-width` describes its shape relative to the screen, not
 * the inline reading direction, and must not flip under a different
 * writing-mode or direction. This utility is a deliberate, narrow exception
 * scoped to that one use case: it sets the physical `min-width` property
 * directly. For the logical default, use `u.minIs()` (`min-inline-size`)
 * instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SizeValue } from "../internal/tokens";

import { utility } from "../internal/descriptor";
import { boxLength } from "../internal/tokens";

/**
 * Applies the physical `min-width` property. Prefer `u.minIs()`
 * (`min-inline-size`) unless the element's sizing is genuinely tied to the
 * physical viewport axis rather than the logical inline axis.
 *
 * @example u.minWidth("full")
 * @example css({ minWidth: "100%" })
 */
export function minWidth<Node extends Element = Element>(value: SizeValue) {
	return utility<Node>(() => ({ minWidth: boxLength(value) }));
}
