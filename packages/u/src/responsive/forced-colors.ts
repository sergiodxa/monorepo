/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { media } from "./media";

/**
 * Sugar over `media("(forced-colors: active)", input)`. Forced-colors mode
 * swaps colors for a system palette — use this to restore non-color cues like
 * borders, or keep an element's own colors via `forced-color-adjust`.
 *
 * @example u.forcedColors(u.forcedColorAdjust("none"))
 * @example css({ "@media (forced-colors: active)": { forcedColorAdjust: "none" } })
 */
export function forcedColors<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return media("(forced-colors: active)", input);
}
