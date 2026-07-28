/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { when } from "./when";

/**
 * Sugar over `when("&:placeholder-shown", input)`, matching an input or
 * textarea while it is empty and therefore still showing its placeholder.
 *
 * This is what makes the float-label pattern possible with no JavaScript:
 * combine it with `u.has()` on the field wrapper and the label can sit inside
 * an empty field, then shrink and move above it the moment the user types —
 * `u.has(":placeholder-shown", ...)` on the wrapper describes the resting
 * position, and the wrapper's default styles describe the floated one.
 *
 * For styling the placeholder *text* itself, use `u.placeholder()`.
 *
 * @example u.placeholderShown(u.fg("neutral.muted"))
 * @example css({ "&:placeholder-shown": { color: "..." } })
 */
export function placeholderShown<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return when<Node>("&:placeholder-shown", input);
}
