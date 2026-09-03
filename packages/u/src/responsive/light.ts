/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor.js";

import { scheme } from "./scheme.js";

/**
 * Sugar over `scheme("light", input)`.
 *
 * @example u.light(u.bg())
 */
export function light<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return scheme("light", input);
}
