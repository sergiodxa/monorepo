/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { when } from "./when";

/**
 * Sugar over `when('&:indeterminate, &[aria-checked="mixed"]', input)`,
 * matching both natively indeterminate controls and ARIA mixed-state custom
 * widgets.
 *
 * `u.checked()` does **not** match this third state — neither `:checked` nor
 * `aria-checked="true"` is true of a mixed checkbox — which is exactly why a
 * tri-state checkbox needs its own wrapper here to paint the dash that stands
 * for "some, but not all".
 *
 * `:indeterminate` is broader than that one case: it also matches every radio
 * button in a group where no option is selected yet, and a `<progress>` with no
 * `value` attribute, so scope it to the control you mean.
 *
 * @example u.indeterminate(u.bg("brand.solid"))
 * @example css({ '&:indeterminate, &[aria-checked="mixed"]': { backgroundColor: "..." } })
 */
export function indeterminate<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return when<Node>('&:indeterminate, &[aria-checked="mixed"]', input);
}
