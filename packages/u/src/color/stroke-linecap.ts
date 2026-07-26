/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSStyles } from "../internal/css-styles";
import type { UtilityMixin } from "../internal/descriptor";

import { utility } from "../internal/descriptor";

/**
 * Sets `stroke-linecap`, the SVG paint property controlling how a
 * `<path>`/`<line>` shape's stroke renders at the two open ends of an
 * unclosed subpath.
 *
 * @example u.strokeLinecap("round")
 * @example css({ strokeLinecap: "round" })
 */
export function strokeLinecap<Node extends Element = Element>(
	value: "butt" | "round" | "square",
): UtilityMixin<Node> {
	return utility<Node>(() => ({ strokeLinecap: value }) as CSSStyles);
}
