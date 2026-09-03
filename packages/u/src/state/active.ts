/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor.js";

import { when } from "./when.js";

/**
 * Sugar over `when("&:active", input)`.
 *
 * @example u.active(u.bg("brand.solid"))
 * @example css({ "&:active": { backgroundColor: "..." } })
 */
export function active<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return when("&:active", input);
}
