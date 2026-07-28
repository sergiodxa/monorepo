/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { when } from "./when";

/**
 * Applies the given utilities to the user's text selection inside the
 * element, via `::selection`. Sugar over `when("&::selection", input)`.
 *
 * Only a small set of properties apply here — `color`, `background-color`,
 * `text-decoration`, and `text-shadow`. Everything else in the wrapped
 * utilities is ignored by the browser.
 *
 * The platform's own selection colors come with a contrast guarantee the user
 * (or their OS high-contrast setting) has already agreed to; overriding them
 * throws that guarantee away. If you do override, keep the pair
 * high-contrast, and always set `color` and `background-color` together
 * rather than one alone.
 *
 * @example u.selection(u.bg("brand.tint"))
 * @example css({ "&::selection": { backgroundColor: "..." } })
 */
export function selection<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return when<Node>("&::selection", input);
}
