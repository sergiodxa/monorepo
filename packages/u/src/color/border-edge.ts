/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSStyles } from "../internal/css-styles.js";
import type { UtilityMixin } from "../internal/descriptor.js";
import type { ColorValue } from "../types.js";

import { utility } from "../internal/descriptor.js";
import { color } from "../internal/tokens.js";

import type { BorderStyleValue } from "./border.js";

/**
 * Edge a single-sided divider border sits on. A logical edge follows writing
 * mode; a physical edge (`"left"`, `"right"`, `"top"`, `"bottom"`) keeps the
 * border pinned to that side under every writing mode.
 */
export type BorderEdge =
	| "block-start"
	| "block-end"
	| "inline-start"
	| "inline-end"
	| "left"
	| "right"
	| "top"
	| "bottom";

export interface BorderEdgeOptions {
	/** Sets the edge's border color. Same accepted shapes as `u.border(value)`. */
	color?: ColorValue | (string & {});
	/** Sets the edge's border width. A bare number is treated as pixels; a string passes through unchanged. */
	width?: number | (string & {});
	/**
	 * Sets the edge's border style. Defaults to `"solid"` when `width` is
	 * given and `style` isn't, matching `u.border()`'s own default.
	 */
	style?: BorderStyleValue;
	/**
	 * Suppresses the `"solid"` default that `width` alone would apply, for when
	 * a separate rule supplies the edge's style and color and this call sets
	 * the width alone. An explicit `style` still wins.
	 */
	noStyleDefault?: boolean;
}

const EDGE_PROPERTY: Record<BorderEdge, string> = {
	"block-start": "borderBlockStart",
	"block-end": "borderBlockEnd",
	"inline-start": "borderInlineStart",
	"inline-end": "borderInlineEnd",
	left: "borderLeft",
	right: "borderRight",
	top: "borderTop",
	bottom: "borderBottom",
};

/**
 * Applies a border to a single edge only, for a divider between two adjacent
 * elements (e.g. two stepper buttons sharing one frame). Only the given keys
 * are set; prefer a logical edge so the divider follows writing mode.
 *
 * @example u.borderEdge("inline-start", { width: 1, style: "solid" })
 * @example css({ borderInlineStartWidth: "1px", borderInlineStartStyle: "solid" })
 * @example u.borderEdge("block-end", { color: "brand", width: 2 })
 * @example css({ borderBlockEndColor: "var(--ui-brand-border)", borderBlockEndWidth: "2px", borderBlockEndStyle: "solid" })
 * @example u.borderEdge("inline-start", { width: 2, noStyleDefault: true })
 * @example css({ borderInlineStartWidth: "2px" })
 * @example u.borderEdge("right", { width: 1, style: "solid", color: "neutral" })
 * @example css({ borderRightWidth: "1px", borderRightStyle: "solid", borderRightColor: "var(--ui-neutral-border)" })
 */
export function borderEdge<Node extends Element = Element>(
	edge: BorderEdge,
	options: BorderEdgeOptions = {},
): UtilityMixin<Node> {
	return utility<Node>(() => {
		let property = EDGE_PROPERTY[edge];
		let result: Record<string, string> = {};
		if (options.color !== undefined) result[`${property}Color`] = color(options.color, "border");
		if (options.width !== undefined) {
			result[`${property}Width`] =
				typeof options.width === "number" ? `${options.width}px` : options.width;
		}
		if (options.style !== undefined) result[`${property}Style`] = options.style;
		else if (options.width !== undefined && !options.noStyleDefault)
			result[`${property}Style`] = "solid";
		return result as CSSStyles;
	});
}
