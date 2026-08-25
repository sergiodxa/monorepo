/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { when } from "./when";

/**
 * Sugar over `when("&:placeholder-shown", input)`, matching an input or
 * textarea while it is empty and therefore still showing its placeholder.
 * Enables the float-label pattern with no JavaScript, paired with `u.has()`.
 *
 * @see u.placeholder - styles the placeholder text itself.
 * @example u.placeholderShown(u.fg("neutral.muted"))
 * @example css({ "&:placeholder-shown": { color: "..." } })
 */
export function placeholderShown<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return when<Node>("&:placeholder-shown", input);
}
