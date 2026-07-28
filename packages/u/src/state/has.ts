/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { when } from "./when";

/**
 * Sugar over `when("&:has({selector})", input)`. Styles an element from the
 * state of its own descendants — the thing no other selector could express
 * before `:has()`, since CSS otherwise only ever walks downwards.
 *
 * The real cases: a field wrapper reacting to its inner input, so the focus
 * ring and error border land on the wrapper instead of the bare control; a
 * card that has an image, so the two-column layout only kicks in when there
 * is art to lay out; a list that has a selected row.
 *
 * `:has()` takes the specificity of its most specific argument, so a heavy
 * selector inside it raises the whole rule's weight and can start winning
 * against declarations you expected to override it.
 *
 * @example u.has("input:user-invalid", u.border("danger"))
 * @example css({ "&:has(input:user-invalid)": { borderColor: "..." } })
 * @example u.has("img", u.p(4))
 * @example css({ "&:has(img)": { padding: "..." } })
 */
export function has<Node extends Element = Element>(
	selector: string,
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return when<Node>(`&:has(${selector})`, input);
}
