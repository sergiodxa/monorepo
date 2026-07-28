/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { media } from "./media";

/**
 * Sugar over `media("(forced-colors: active)", input)`.
 *
 * In forced-colors mode the platform replaces colors with its own limited
 * palette, so most color declarations stop having any effect at all. That
 * makes this the place to fix anything colour alone was carrying: restoring
 * a border so a shape stays visible once its background is overridden, or
 * setting `forced-color-adjust` through `u.raw()` for the rare element that
 * must keep its own colors.
 *
 * The system color keywords (`Canvas`, `CanvasText`, `Highlight`) keep
 * working here, which is why this package's no-argument defaults — built on
 * those keywords — degrade gracefully without needing this wrapper.
 *
 * @example u.forcedColors(u.forcedColorAdjust("none"))
 * @example css({ "@media (forced-colors: active)": { forcedColorAdjust: "none" } })
 */
export function forcedColors<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return media("(forced-colors: active)", input);
}
