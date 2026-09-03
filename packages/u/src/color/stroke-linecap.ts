/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSStyles } from "../internal/css-styles.js";
import type { UtilityMixin } from "../internal/descriptor.js";

import { utility } from "../internal/descriptor.js";

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
