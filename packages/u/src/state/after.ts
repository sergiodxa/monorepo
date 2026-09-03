/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor.js";

import { when } from "./when.js";

/**
 * Applies the given utilities to an element's `::after` pseudo-element.
 * Sugar over `when("&::after", input)`.
 *
 * @example u.after([u.raw({ content: '""' }), u.absolute()])
 * @example css({ "&::after": { content: '""', position: "absolute" } })
 */
export function after<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return when<Node>("&::after", input);
}
