/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSStyles } from "../internal/css-styles.js";
import type { UtilityMixin } from "../internal/descriptor.js";
import type { ColorValue } from "../types.js";

import { var as varUtility } from "../general/var.js";
import { utility } from "../internal/descriptor.js";
import { color } from "../internal/tokens.js";

export type OutlineStyleValue =
	| "solid"
	| "dashed"
	| "dotted"
	| "double"
	| "groove"
	| "ridge"
	| "inset"
	| "outset"
	| "none"
	| "auto";

export interface OutlineOptions {
	/** Defaults to the system ring color. */
	color?: ColorValue | (string & {});
	/** A bare number is treated as pixels; a string passes through unchanged. Defaults to `2`. */
	width?: number | (string & {});
	/** Defaults to `"solid"`. */
	style?: OutlineStyleValue;
	/** The gap between the outline and the element's border edge, emitted as its own declaration. A bare number is treated as pixels; a string passes through unchanged. */
	offset?: number | (string & {});
}

/**
 * Applies an outline unconditionally, for a persistent or decorative edge. A
 * bare string is a color, a bare number is a width in pixels, the two together
 * set both, and an options object sets every property at once.
 *
 * @example u.outline()
 * @example css({ outlineColor: "var(--ui-ring, Highlight)", outlineWidth: "2px", outlineStyle: "solid" })
 * @example u.outline("danger")
 * @example css({ outlineColor: "var(--ui-danger-ring)", outlineWidth: "2px", outlineStyle: "solid" })
 * @example u.outline(4)
 * @example css({ outlineColor: "var(--ui-ring, Highlight)", outlineWidth: "4px", outlineStyle: "solid" })
 * @example u.outline("danger", 4)
 * @example css({ outlineColor: "var(--ui-danger-ring)", outlineWidth: "4px", outlineStyle: "solid" })
 * @example u.outline({ color: "danger", offset: 4 })
 * @example css({ outlineColor: "var(--ui-danger-ring)", outlineWidth: "2px", outlineStyle: "solid", outlineOffset: "4px" })
 * @example u.outline("none")
 * @example css({ outline: "none" })
 */
export function outline<Node extends Element = Element>(): UtilityMixin<Node>;
export function outline<Node extends Element = Element>(
	color: ColorValue | (string & {}),
): UtilityMixin<Node>;
export function outline<Node extends Element = Element>(width: number): UtilityMixin<Node>;
export function outline<Node extends Element = Element>(
	color: ColorValue | (string & {}),
	width: number,
): UtilityMixin<Node>;
export function outline<Node extends Element = Element>(
	options: OutlineOptions,
): UtilityMixin<Node>;
export function outline<Node extends Element = Element>(
	colorOrWidthOrOptions?: ColorValue | (string & {}) | number | OutlineOptions,
	width?: number,
): UtilityMixin<Node> {
	if (colorOrWidthOrOptions === "none") {
		return utility<Node>(() => ({ outline: "none" }));
	}

	let options: OutlineOptions;
	if (colorOrWidthOrOptions === undefined) {
		options = {};
	} else if (typeof colorOrWidthOrOptions === "number") {
		options = { width: colorOrWidthOrOptions };
	} else if (typeof colorOrWidthOrOptions === "string") {
		options =
			width === undefined
				? { color: colorOrWidthOrOptions }
				: { color: colorOrWidthOrOptions, width };
	} else {
		options = colorOrWidthOrOptions;
	}

	return utility<Node>(() => {
		let result: Record<string, string> = {
			outlineColor: options.color
				? color(options.color, "ring")
				: varUtility("ui-ring", "Highlight"),
			outlineWidth:
				typeof options.width === "number" ? `${options.width}px` : (options.width ?? "2px"),
			outlineStyle: options.style ?? "solid",
		};
		if (options.offset !== undefined) {
			result.outlineOffset =
				typeof options.offset === "number" ? `${options.offset}px` : options.offset;
		}
		return result as CSSStyles;
	});
}
