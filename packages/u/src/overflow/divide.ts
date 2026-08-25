/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSStyles } from "../internal/css-styles";
import type { ColorValue } from "../types";

import { var as varUtility } from "../general/var";
import { utility } from "../internal/descriptor";
import { color } from "../internal/tokens";
import { when } from "../state/when";

export type DivideAxis = "block" | "inline";

/** Same tiny system default `u.border()` falls back to when no color is given. */
const DEFAULT_BORDER_COLOR = varUtility(
	"ui-border",
	"color-mix(in oklab, CanvasText 16%, transparent)",
);

/**
 * Applies a divider border between every child except the last, along `axis`.
 * A number in the color position is read as the border width, so a width can
 * be set alone; a color name resolves through the semantic and palette tokens.
 *
 * @example u.divide()
 * @example css({ "& > *:not(:last-child)": { borderStyle: "solid", borderBlockEndWidth: "1px", borderBlockEndColor: "var(--ui-border, color-mix(in oklab, CanvasText 16%, transparent))" } })
 * @example u.divide("block", "brand", 2)
 * @example css({ "& > *:not(:last-child)": { borderStyle: "solid", borderBlockEndWidth: "2px", borderBlockEndColor: "var(--ui-brand-border)" } })
 * @example u.divide("block", 2)
 * @example css({ "& > *:not(:last-child)": { borderStyle: "solid", borderBlockEndWidth: "2px", borderBlockEndColor: "var(--ui-border, color-mix(in oklab, CanvasText 16%, transparent))" } })
 */
export function divide<Node extends Element = Element>(
	axis: DivideAxis = "block",
	colorOrWidth?: ColorValue | (string & {}) | number,
	maybeWidth?: number,
) {
	let resolvedColor = DEFAULT_BORDER_COLOR;
	let width = 1;
	if (typeof colorOrWidth === "number") {
		width = colorOrWidth;
	} else if (typeof colorOrWidth === "string") {
		resolvedColor = color(colorOrWidth, "border");
		width = maybeWidth ?? 1;
	}
	let declarations: Record<string, string> = { borderStyle: "solid" };
	if (axis === "block") {
		declarations.borderBlockEndWidth = `${width}px`;
		declarations.borderBlockEndColor = resolvedColor;
	} else {
		declarations.borderInlineEndWidth = `${width}px`;
		declarations.borderInlineEndColor = resolvedColor;
	}
	return when<Node>(
		"& > *:not(:last-child)",
		utility<Node>(() => declarations as CSSStyles),
	);
}
