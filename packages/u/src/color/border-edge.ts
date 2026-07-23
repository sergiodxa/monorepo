/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSStyles } from "../internal/css-styles";
import type { UtilityMixin } from "../internal/descriptor";
import type { ColorValue } from "../types";

import { utility } from "../internal/descriptor";
import { color } from "../internal/tokens";

import type { BorderStyleValue } from "./border";

/** Logical edge a single-sided divider border sits on. */
export type BorderEdge = "block-start" | "block-end" | "inline-start" | "inline-end";

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
}

const EDGE_PROPERTY: Record<BorderEdge, string> = {
	"block-start": "borderBlockStart",
	"block-end": "borderBlockEnd",
	"inline-start": "borderInlineStart",
	"inline-end": "borderInlineEnd",
};

/**
 * Applies a border to a single logical edge only — a divider between two
 * adjacent elements (e.g. two stepper buttons sharing one frame) rather than
 * a border around all four sides. Only the given keys are set, same as
 * `u.border()`'s options form.
 *
 * @example u.borderEdge("inline-start", { width: 1, style: "solid" })
 * @example css({ borderInlineStartWidth: "1px", borderInlineStartStyle: "solid" })
 * @example u.borderEdge("block-end", { color: "brand", width: 2 })
 * @example css({ borderBlockEndColor: "var(--ui-brand-border)", borderBlockEndWidth: "2px", borderBlockEndStyle: "solid" })
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
		else if (options.width !== undefined) result[`${property}Style`] = "solid";
		return result as CSSStyles;
	});
}
