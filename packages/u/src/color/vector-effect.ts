/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSStyles } from "../internal/css-styles";
import type { UtilityMixin } from "../internal/descriptor";

import { utility } from "../internal/descriptor";

/**
 * Sets `vector-effect`, the SVG property that can exempt a shape from its
 * ancestor transforms — most commonly `"non-scaling-stroke"`, which keeps a
 * chart line's stroke width constant while the chart itself scales or
 * zooms.
 *
 * @example u.vectorEffect("non-scaling-stroke")
 * @example css({ vectorEffect: "non-scaling-stroke" })
 */
export function vectorEffect<Node extends Element = Element>(
	value: "none" | "non-scaling-stroke" | "non-scaling-size" | "non-rotation" | "fixed-position",
): UtilityMixin<Node> {
	return utility<Node>(() => ({ vectorEffect: value }) as CSSStyles);
}
