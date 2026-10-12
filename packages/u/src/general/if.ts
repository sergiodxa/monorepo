/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor.js";

import { combine } from "./combine.js";

/**
 * Conditionally returns `input` as one mixin, or `false` when `condition` is
 * falsy. A list of utilities is merged through `u.combine()` into a single
 * class, so it cascades as one unit wherever it sits in a `mix` list.
 *
 * @example u.if(isActive, u.bg("brand.tint"))
 * @example u.if(isActive, [u.bg("brand.solid"), u.fg("brand.onSolid")])
 */
function ifUtility<Node extends Element = Element>(
	condition: unknown,
	input: UtilityInput<Node>,
): UtilityMixin<Node> | false {
	if (!condition || !input) return false;
	if (Array.isArray(input)) return combine<Node>(input);
	return input as UtilityMixin<Node>;
}

export { ifUtility as if };
