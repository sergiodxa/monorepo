/**
 * Some components size themselves against the physical viewport axis, such
 * as a chat bubble whose shape must stay fixed regardless of writing-mode or
 * direction. This utility sets the physical `min-width` property for that
 * case; `u.minIs()` sets the logical `min-inline-size` default.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SizeValue } from "../internal/tokens";

import { utility } from "../internal/descriptor";
import { boxLength } from "../internal/tokens";

/**
 * Applies the physical `min-width` property, for elements whose sizing is
 * tied to the physical viewport axis. Prefer `u.minIs()`
 * (`min-inline-size`) for the logical default.
 *
 * @example u.minWidth("full")
 * @example css({ minWidth: "100%" })
 */
export function minWidth<Node extends Element = Element>(value: SizeValue) {
	return utility<Node>(() => ({ minWidth: boxLength(value) }));
}
