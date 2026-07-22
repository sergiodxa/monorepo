/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { when } from "./when";

/**
 * Sugar over `when('&:checked, &[aria-checked="true"]', input)`, matching
 * both native checked controls and ARIA-checked custom widgets.
 *
 * @example u.checked(u.bg("brand.solid"))
 * @example css({ '&:checked, &[aria-checked="true"]': { backgroundColor: "..." } })
 */
export function checked<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return when('&:checked, &[aria-checked="true"]', input);
}
