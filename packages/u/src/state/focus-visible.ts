/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { when } from "./when";

/**
 * Sugar over `when("&:focus-visible", input)`.
 *
 * @example u.focusVisible(u.ring("brand"))
 * @example css({ "&:focus-visible": { outlineColor: "..." } })
 */
export function focusVisible<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return when("&:focus-visible", input);
}
