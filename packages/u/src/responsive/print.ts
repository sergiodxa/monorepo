/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { media } from "./media";

/**
 * Sugar over `media("print", input)`. `"print"` is a media type, so it's
 * passed without parentheses — used to hide interactive chrome, force a
 * light surface, and expand truncated content back to full height on paper.
 *
 * @example u.print(u.hidden())
 * @example css({ "@media print": { display: "none" } })
 */
export function print<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return media("print", input);
}
