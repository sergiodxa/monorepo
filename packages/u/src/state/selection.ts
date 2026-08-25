/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { when } from "./when";

/**
 * Applies utilities to the element's `::selection`; only `color`,
 * `background-color`, `text-decoration`, and `text-shadow` take effect, and
 * overriding the platform's contrast guarantee requires a high-contrast pair.
 *
 * @example u.selection(u.bg("brand.tint"))
 * @example css({ "&::selection": { backgroundColor: "..." } })
 */
export function selection<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return when<Node>("&::selection", input);
}
