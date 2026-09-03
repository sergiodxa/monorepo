/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSStyles } from "../internal/css-styles.js";
import type { UtilityMixin } from "../internal/descriptor.js";

import { utility } from "../internal/descriptor.js";

/**
 * Sets `stroke-linejoin`, the SVG paint property controlling how a
 * `<path>`/`<polyline>`/`<polygon>` shape's stroke renders at a corner
 * between two segments.
 *
 * @example u.strokeLinejoin("round")
 * @example css({ strokeLinejoin: "round" })
 */
export function strokeLinejoin<Node extends Element = Element>(
	value: "miter" | "round" | "bevel",
): UtilityMixin<Node> {
	return utility<Node>(() => ({ strokeLinejoin: value }) as CSSStyles);
}
