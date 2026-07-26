/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { TextSizeName } from "../types";

import { var as varUtility } from "../general/var";
import { utility } from "../internal/descriptor";
import { text as textToken } from "../internal/tokens";

/**
 * Paired line-height fallback for each named text size, matching the
 * standard type scale's own font-size/line-height pairing (e.g. `sm`'s
 * `0.875rem` pairs with a `1.25rem` line height, expressed here as the
 * unitless `calc(1.25 / 0.875)` ratio so it scales with the font size
 * instead of fighting it). Sizes `5xl` and up collapse to a unitless `1`,
 * matching how a large display size reads best with tight, font-size-sized
 * leading rather than extra line gap.
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
 * Applies `font-size` from the named text scale (`xs` through `9xl`, or an
 * app-extended name) together with its paired `line-height`. Font size
 * resolves through `var(--ui-text-{name}, fallback)`; line height resolves
 * through the companion `var(--ui-leading-{name}, fallback)` variable, each
 * name's fallback matching that size's own place in the type scale (see
 * {@link LEADING_FALLBACKS}), so an app extending the scale with, say,
 * `hero` gets a sensible default the moment it defines `--ui-text-hero`,
 * before ever also defining `--ui-leading-hero`. This utility does not set
 * `font-family`; pair it with `u.font()` or reach for `u.type()` when a call
 * site also wants the base sans family in one call.
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
