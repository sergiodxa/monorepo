/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { when } from "./when";

/**
 * Sugar over `when("&:has(~ {selector})", input)`, styling an element by a
 * sibling's state. `~` matches only *following* siblings, so the indicator
 * must come before the source input in the DOM.
 *
 * @example u.hasSibling("input:checked", u.bg("brand.solid"))
 * @example css({ "&:has(~ input:checked)": { backgroundColor: "..." } })
 * @example u.hasSibling("input:disabled", u.opacity(50))
 * @example css({ "&:has(~ input:disabled)": { opacity: 0.5 } })
 */
export function hasSibling<Node extends Element = Element>(
	selector: string,
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return when<Node>(`&:has(~ ${selector})`, input);
}
