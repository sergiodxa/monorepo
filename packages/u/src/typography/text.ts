/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { TextSizeName } from "../types";

import { var as varUtility } from "../general/var";
import { utility } from "../internal/descriptor";
import { text as textToken } from "../internal/tokens";

/**
 * Fallback line-height per named text size, as a unitless ratio (e.g.
 * `calc(1.25 / 0.875)` for `sm`) so leading scales with its paired font size;
 * sizes `5xl` and up use a flat `1` for tight, display-sized leading.
 */
const LEADING_FALLBACKS: Record<TextSizeName, string> = {
	xs: "calc(1 / 0.75)",
	sm: "calc(1.25 / 0.875)",
	base: "1.5",
	lg: "calc(1.75 / 1.125)",
	xl: "1.4",
	"2xl": "calc(2 / 1.5)",
	"3xl": "1.2",
	"4xl": "calc(2.5 / 2.25)",
	"5xl": "1",
	"6xl": "1",
	"7xl": "1",
	"8xl": "1",
	"9xl": "1",
};

/**
 * Applies `font-size` and its paired `line-height` from the named text scale
 * through matching `var(--ui-text-*)` / `var(--ui-leading-*)` properties, so
 * an extended name inherits a sensible default leading before defining one.
 *
 * @example u.text("lg")
 * @example css({ fontSize: "var(--ui-text-lg, 1.125rem)", lineHeight: "var(--ui-leading-lg, calc(1.75 / 1.125))" })
 */
export function text<Node extends Element = Element>(name: TextSizeName | (string & {})) {
	return utility<Node>(() => ({
		fontSize: textToken(name),
		lineHeight: varUtility(`ui-leading-${name}`, LEADING_FALLBACKS[name as TextSizeName] ?? "1.5"),
	}));
}
