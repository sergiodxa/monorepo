/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { media } from "./media";

/**
 * Sugar over `media("print", input)`.
 *
 * `"print"` is a media *type*, not a feature query, so it is passed without
 * parentheses — and this is the one wrapper in the family that isn't about a
 * user preference at all.
 *
 * The real uses: hiding interactive chrome that means nothing on paper
 * (navigation, buttons, sticky bars), forcing a light surface so a dark
 * theme doesn't print as a block of ink, and expanding a truncated or
 * line-clamped block back to its full height so no content is cut off.
 *
 * @example u.print(u.hidden())
 * @example css({ "@media print": { display: "none" } })
 */
export function print<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return media("print", input);
}
