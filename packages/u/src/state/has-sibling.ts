/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { when } from "./when";

/**
 * Sugar over `when("&:has(~ {selector})", input)`. Styles an element from the
 * state of a sibling rather than a descendant.
 *
 * This is the compound-control idiom: a visually-hidden native `<input>` paired
 * with a sibling element that paints the visible indicator, where the indicator
 * needs to read the input's state — checked, focused, disabled — while the
 * input itself stays the real, accessible, form-submitting control. It is the
 * single most repeated hand-written selector pattern in real usage, which is
 * why it gets a name of its own.
 *
 * The `~` combinator only looks at *following* siblings, so this matches only
 * when the element matching `selector` comes after the styled element in the
 * DOM — put the indicator first and the hidden input after it. Reach for
 * `has()` instead when the state lives on a descendant, and for a wrapper
 * around both elements when the source order has to go the other way.
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
