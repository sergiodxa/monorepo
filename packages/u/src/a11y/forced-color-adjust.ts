/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * The standard `forced-color-adjust` keywords. `"auto"` is the default
 * behaviour, letting the browser override the element's colours in a
 * forced-colors mode; `"none"` opts the element out of that override
 * entirely; `"preserve-parent-color"` opts out too but keeps inheriting
 * `color` from the parent instead of resolving it from the author stylesheet.
 */
export type ForcedColorAdjustValue = "auto" | "none" | "preserve-parent-color";

/**
 * Applies `forced-color-adjust`. Defaults to `"none"`, the only value worth
 * spelling out, since `"auto"` is already what every element does.
 *
 * In a forced-colors mode the browser replaces author colours with the user's
 * own palette. That is the correct default and must not be casually defeated:
 * a user who turned it on did so because the palette they chose is the one
 * they can read. Setting `forced-color-adjust: none` opts an element out of
 * that override, so the author's colours survive.
 *
 * Opting out is defensible only where colour *is* the information and the
 * platform palette would destroy it — a colour picker's swatches, a chart's
 * series legend, a syntax-highlighted code block, a brand logo. It is not a
 * licence to preserve a visual design against a user's accessibility setting.
 * A genuinely necessary opt-out also usually needs a non-colour cue — a
 * label, a pattern, a shape — so the information still survives for users who
 * cannot distinguish the colours either way.
 *
 * Pair this with `u.forcedColors()`, the wrapper that scopes these
 * declarations to the mode where they apply, rather than declaring the
 * opt-out unconditionally.
 *
 * @example u.forcedColorAdjust()
 * @example css({ forcedColorAdjust: "none" })
 * @example u.forcedColorAdjust("preserve-parent-color")
 * @example css({ forcedColorAdjust: "preserve-parent-color" })
 */
export function forcedColorAdjust<Node extends Element = Element>(
	value: ForcedColorAdjustValue = "none",
) {
	return utility<Node>(() => ({ forcedColorAdjust: value }));
}
