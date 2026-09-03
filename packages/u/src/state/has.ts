/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor.js";

import { when } from "./when.js";

/**
 * Sugar over `when("&:has({selector})", input)`. Styles an element by its own
 * descendants' state; `:has()` takes the specificity of its heaviest argument,
 * so a complex selector here can outweigh overriding declarations.
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
