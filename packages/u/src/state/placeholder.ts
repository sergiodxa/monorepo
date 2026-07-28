/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { when } from "./when";

/**
 * Applies the given utilities to an input or textarea's `::placeholder` text.
 * Sugar over `when("&::placeholder", input)`.
 *
 * Placeholder text is not a label substitute: it vanishes the moment the user
 * types, and browsers render it at a contrast ratio that often fails on its
 * own. Styling it does not remove the need for a real `<label>` — give the
 * field a label and use the placeholder for an example value at most.
 *
 * For styling the *input itself* while it is empty and showing that
 * placeholder, use `u.placeholderShown()`.
 *
 * @example u.placeholder(u.fg("neutral.muted"))
 * @example css({ "&::placeholder": { color: "..." } })
 */
export function placeholder<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return when<Node>("&::placeholder", input);
}
