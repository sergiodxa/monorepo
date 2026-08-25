/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { when } from "./when";

/**
 * Matches indeterminate checkboxes and ARIA mixed-state widgets, painting a
 * third visual state; it also matches radios in an unselected group and
 * valueless `<progress>`, so scope it to the control you mean.
 *
 * @example u.indeterminate(u.bg("brand.solid"))
 * @example css({ '&:indeterminate, &[aria-checked="mixed"]': { backgroundColor: "..." } })
 */
export function indeterminate<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return when<Node>('&:indeterminate, &[aria-checked="mixed"]', input);
}
