/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { when } from "./when";

/**
 * Applies the given utilities to a top-layer element's `::backdrop`, the
 * layer the browser paints behind a `<dialog>` or popover to dim the page
 * with no overlay, z-index, or scroll container; pairs with `u.open()`.
 *
 * @example u.backdrop(u.bg("neutral.solid"))
 * @example css({ "&::backdrop": { backgroundColor: "..." } })
 */
export function backdrop<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return when<Node>("&::backdrop", input);
}
