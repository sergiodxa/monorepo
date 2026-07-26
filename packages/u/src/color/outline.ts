/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSStyles } from "../internal/css-styles";
import type { UtilityMixin } from "../internal/descriptor";
import type { ColorValue } from "../types";

import { var as varUtility } from "../general/var";
import { utility } from "../internal/descriptor";
import { color } from "../internal/tokens";

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
	/** Sets `outline-color`. Accepts the same shapes as `u.border()`'s color; defaults to the system ring color when omitted. */
	color?: ColorValue | (string & {});
	/** Sets `outline-width`. A bare number is treated as pixels; a string passes through unchanged. Defaults to `2`. */
	width?: number | (string & {});
	/** Sets `outline-style`. Defaults to `"solid"`. */
	style?: OutlineStyleValue;
	/** Sets `outline-offset`, the gap between the outline and the element's border edge — always a separate property from `outline`, never part of its shorthand. A bare number is treated as pixels; a string passes through unchanged. */
	offset?: number | (string & {});
}

/**
 * Applies an outline: `outline-color`/`outline-width`/`outline-style`
 * together with `outline-offset` — a property CSS's `outline` shorthand
 * never includes, so setting it always takes a separate declaration. Unlike
 * `u.ring()`, this is unconditional — it doesn't nest under
 * `&:focus-visible`, so use it for a persistent or decorative outline
 * rather than a focus indicator. A bare string is a color, a bare number is
 * a width (in pixels), the two together set both, and an options object
 * sets every property at once.
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
