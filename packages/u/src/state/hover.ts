/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor.js";

import { when } from "./when.js";

/**
 * Sugar over `when("&:hover", input)`.
 *
 * @example u.hover(u.bg("brand.tint"))
 * @example css({ "&:hover": { backgroundColor: "..." } })
 */
export function hover<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return when("&:hover", input);
}
