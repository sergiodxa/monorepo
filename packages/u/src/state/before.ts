/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor.js";

import { when } from "./when.js";

/**
 * Applies the given utilities to an element's `::before` pseudo-element.
 * Sugar over `when("&::before", input)`.
 *
 * @example u.before([u.raw({ content: '""' }), u.absolute()])
 * @example css({ "&::before": { content: '""', position: "absolute" } })
 */
export function before<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return when<Node>("&::before", input);
}
