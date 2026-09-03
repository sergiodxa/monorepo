/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSStyles } from "../internal/css-styles.js";
import type { UtilityMixin } from "../internal/descriptor.js";
import type { ColorValue } from "../types.js";

import { utility } from "../internal/descriptor.js";
import { color } from "../internal/tokens.js";

export type TextDecorationLineValue = "none" | "underline" | "overline" | "line-through";

export type TextDecorationStyleValue = "solid" | "double" | "dotted" | "dashed" | "wavy";

export interface TextDecorationOptions {
	/** Sets `text-decoration-line`. Same accepted values as `u.textDecoration(value)`. */
	line?: TextDecorationLineValue;
	/**
	 * Sets `text-decoration-color`, resolved through the token layer with a
	 * default property of `fg`, so a bare tone works and a decoration can be
	 * tinted independently of the text's own color.
	 */
	color?: ColorValue | (string & {});
	/** Sets `text-decoration-style`. */
	style?: TextDecorationStyleValue;
	/**
	 * Sets `text-decoration-thickness`. A bare number is treated as pixels; a
	 * string passes through unchanged, which is how `"auto"` and `"from-font"`
	 * are expressed.
	 */
	thickness?: number | (string & {});
	/**
	 * Sets `text-underline-offset`, the distance between the text's baseline
	 * and its underline. A bare number is treated as pixels; a string passes
	 * through unchanged, including `"auto"`.
	 */
	offset?: number | (string & {});
}

/**
 * Applies `text-decoration-line` from a bare value, or sets only the given
 * keys from a text-decoration options object. `thickness` and `offset` are
 * kept separate because `text-decoration`'s shorthand cannot set or reset them.
 *
 * @example u.textDecoration()
 * @example css({ textDecorationLine: "underline" })
 * @example u.textDecoration("line-through")
 * @example css({ textDecorationLine: "line-through" })
 * @example u.textDecoration({ line: "underline", color: "brand", offset: 3 })
 * @example css({ textDecorationLine: "underline", textDecorationColor: "var(--ui-brand-fg)", textUnderlineOffset: "3px" })
 * @example u.textDecoration({ style: "wavy", color: "danger", thickness: "from-font" })
 * @example css({ textDecorationStyle: "wavy", textDecorationColor: "var(--ui-danger-fg)", textDecorationThickness: "from-font" })
 */
export function textDecoration<Node extends Element = Element>(
	value?: TextDecorationLineValue,
): UtilityMixin<Node>;
export function textDecoration<Node extends Element = Element>(
	options: TextDecorationOptions,
): UtilityMixin<Node>;
export function textDecoration<Node extends Element = Element>(
	valueOrOptions: TextDecorationLineValue | TextDecorationOptions = "underline",
): UtilityMixin<Node> {
	if (typeof valueOrOptions === "string") {
		return utility<Node>(() => ({ textDecorationLine: valueOrOptions }));
	}

	let options = valueOrOptions;
	return utility<Node>(() => {
		let result: Record<string, string> = {};
		if (options.line !== undefined) result.textDecorationLine = options.line;
		if (options.color !== undefined) result.textDecorationColor = color(options.color, "fg");
		if (options.style !== undefined) result.textDecorationStyle = options.style;
		if (options.thickness !== undefined) {
			result.textDecorationThickness =
				typeof options.thickness === "number" ? `${options.thickness}px` : options.thickness;
		}
		if (options.offset !== undefined) {
			result.textUnderlineOffset =
				typeof options.offset === "number" ? `${options.offset}px` : options.offset;
		}
		return result as CSSStyles;
	});
}
