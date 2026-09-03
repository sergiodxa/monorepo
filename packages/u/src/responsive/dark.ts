/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor.js";

import { scheme } from "./scheme.js";

/**
 * Sugar over `scheme("dark", input)`.
 *
 * @example u.dark(u.bg("neutral.solid"))
 */
export function dark<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return scheme("dark", input);
}
