/**
 * A deliberate exception in the logical-property-first `size/` family: sets
 * the physical `max-width` property for elements whose sizing is pinned to
 * the physical viewport axis, staying fixed across writing-mode and
 * direction changes. Use `u.maxIs()` (`max-inline-size`) for the logical
 * default.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SizeValue } from "../internal/tokens.js";

import { utility } from "../internal/descriptor.js";
import { boxLength } from "../internal/tokens.js";

/**
 * Applies the physical `max-width` property, for elements whose sizing is
 * genuinely tied to the physical viewport axis. Prefer `u.maxIs()`
 * (`max-inline-size`) for the logical default.
 *
 * @example u.maxWidth("full")
 * @example css({ maxWidth: "100%" })
 */
export function maxWidth<Node extends Element = Element>(value: SizeValue) {
	return utility<Node>(() => ({ maxWidth: boxLength(value) }));
}
