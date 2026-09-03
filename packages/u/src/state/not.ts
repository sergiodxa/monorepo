/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor.js";

import { when } from "./when.js";

/**
 * A selector wrapper for negated state: wraps `selector` in `:not(...)` and
 * applies the given utilities there.
 *
 * @example u.not(":disabled", u.opacity(100))
 * @example css({ "&:not(:disabled)": { opacity: 1 } })
 */
export function not<Node extends Element = Element>(
	selector: string,
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return when(`&:not(${selector})`, input);
}
