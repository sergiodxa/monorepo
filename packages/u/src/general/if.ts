/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput } from "../internal/descriptor";

/**
 * Conditionally returns `input`, or a falsy value when `condition` is falsy.
 * `mix` already accepts falsy values directly (`mix={[cond && u.bg()]}`), so
 * this serves call sites that prefer a utility-shaped conditional.
 *
 * @example u.if(isActive, u.bg("brand.tint"))
 * @example isActive ? u.bg("brand.tint") : false
 */
function ifUtility<Node extends Element = Element>(
	condition: unknown,
	input: UtilityInput<Node>,
): UtilityInput<Node> {
	return condition ? input : false;
}

export { ifUtility as if };
