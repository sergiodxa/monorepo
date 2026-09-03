/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

/**
 * The standard `forced-color-adjust` keywords: `"auto"` lets the browser
 * override colours in a forced-colors mode, `"none"` opts the element out,
 * and `"preserve-parent-color"` opts out while inheriting `color`.
 */
export type ForcedColorAdjustValue = "auto" | "none" | "preserve-parent-color";

/**
 * Applies `forced-color-adjust`, defaulting to `"none"` so author colours
 * survive where colour itself carries the information — swatches, chart
 * legends, syntax highlighting. Scope it with `u.forcedColors()`.
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
