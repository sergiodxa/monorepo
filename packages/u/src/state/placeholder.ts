/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor.js";

import { when } from "./when.js";

/**
 * Styles an input or textarea's `::placeholder` text. Give the field a real
 * `<label>` too, since placeholder text vanishes on input and often renders
 * at low contrast; style the empty input itself with `u.placeholderShown()`.
 *
 * @example u.placeholder(u.fg("neutral.muted"))
 * @example css({ "&::placeholder": { color: "..." } })
 */
export function placeholder<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return when<Node>("&::placeholder", input);
}
