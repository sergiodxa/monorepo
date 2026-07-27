/**
 * `@pkg/u` is logical-property-first everywhere else in the `size/` family
 * (`u.maxIs()`, `u.maxBs()`, ...), but some components size themselves
 * relative to the physical viewport/container axis on purpose — e.g. a chat
 * bubble whose `max-width` describes its shape relative to the screen, not
 * the inline reading direction, and must not flip under a different
 * writing-mode or direction. This utility is a deliberate, narrow exception
 * scoped to that one use case: it sets the physical `max-width` property
 * directly. For the logical default, use `u.maxIs()` (`max-inline-size`)
 * instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SizeValue } from "../internal/tokens";

import { utility } from "../internal/descriptor";
import { boxLength } from "../internal/tokens";

/**
 * Applies the physical `max-width` property. Prefer `u.maxIs()`
 * (`max-inline-size`) unless the element's sizing is genuinely tied to the
 * physical viewport axis rather than the logical inline axis.
 *
 * @example u.maxWidth("full")
 * @example css({ maxWidth: "100%" })
 */
export function maxWidth<Node extends Element = Element>(value: SizeValue) {
	return utility<Node>(() => ({ maxWidth: boxLength(value) }));
}
