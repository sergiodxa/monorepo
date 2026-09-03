/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor.js";

import { when } from "./when.js";

/**
 * Sugar over `when("&:focus-within", input)`.
 *
 * @example u.focusWithin(u.border("brand"))
 * @example css({ "&:focus-within": { borderColor: "..." } })
 */
export function focusWithin<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return when("&:focus-within", input);
}
