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

export type BorderStyleValue =
	| "solid"
	| "dashed"
	| "dotted"
	| "double"
	| "groove"
	| "ridge"
	| "inset"
	| "outset"
	| "none"
	| "hidden";

export interface BorderOptions {
	/** Sets `border-color`. Same accepted shapes as `u.border(value)`. */
	color?: ColorValue | (string & {});
	/** Sets `border-width`. A bare number is treated as pixels; a string passes through unchanged. */
	width?: number | (string & {});
	/**
	 * Sets `border-style`. Defaults to `"solid"` when `width` is given and
	 * `style` isn't — `border-color`/`border-width` alone render nothing,
	 * since CSS's initial `border-style` is `none`.
	 */
	style?: BorderStyleValue;
}

/**
 * Applies `border-color`, or a full set of border properties when given an
 * options object instead of a bare color. Called with no argument it
 * resolves the tiny system default (`var(--ui-border, ...)`); called with a
 * bare tone it defaults to that tone's plain `border` weight, promoted to
 * `border-strong` under `prefers-contrast: more` by the theme layer. Called
 * with an options object, only the given keys are set.
 *
 * @example u.border()
 * @example css({ borderColor: "var(--ui-border, color-mix(in oklab, CanvasText 16%, transparent))" })
 * @example u.border("brand.strong")
 * @example css({ borderColor: "var(--ui-brand-border-strong)" })
 * @example u.border({ color: "brand", width: 2 })
 * @example css({ borderColor: "var(--ui-brand-border)", borderWidth: "2px", borderStyle: "solid" })
 * @example u.border("none")
 * @example css({ border: "none" })
 */
export function border<Node extends Element = Element>(
	value?: ColorValue | (string & {}),
): UtilityMixin<Node>;
export function border<Node extends Element = Element>(options: BorderOptions): UtilityMixin<Node>;
export function border<Node extends Element = Element>(
	valueOrOptions?: ColorValue | (string & {}) | BorderOptions,
): UtilityMixin<Node> {
	if (valueOrOptions === "none") {
		return utility<Node>(() => ({ border: "none" }));
	}

	if (valueOrOptions === undefined || typeof valueOrOptions === "string") {
		return utility<Node>(() => ({
			borderColor: valueOrOptions
				? color(valueOrOptions, "border")
				: varUtility("ui-border", "color-mix(in oklab, CanvasText 16%, transparent)"),
		}));
	}

	let options = valueOrOptions;
	return utility<Node>(() => {
		let result: Record<string, string> = {};
		if (options.color !== undefined) result.borderColor = color(options.color, "border");
		if (options.width !== undefined) {
			result.borderWidth = typeof options.width === "number" ? `${options.width}px` : options.width;
		}
		if (options.style !== undefined) result.borderStyle = options.style;
		else if (options.width !== undefined) result.borderStyle = "solid";
		return result as CSSStyles;
	});
}
