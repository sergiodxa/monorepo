/**
 * `@pkg/u` is logical-property-first everywhere else in the `size/` family
 * (`u.p()`, `u.pi()`, `u.pbs()`, ...), but the safe-area insets the platform
 * exposes through `env(safe-area-inset-*)` are defined in physical terms —
 * there's no logical equivalent, since the notch/home-indicator geometry
 * they describe doesn't flip with writing mode. This utility is a
 * deliberate, narrow exception scoped to that one use case: it sets the
 * single physical padding property matching `side`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSStyles } from "../internal/css-styles";
import type { UtilityMixin } from "../internal/descriptor";

import { env } from "../general/env";
import { utility } from "../internal/descriptor";

/** A physical side matching one of the platform's `safe-area-inset-*` environment variables. */
export type SafeAreaSide = "left" | "right" | "top" | "bottom";

const SAFE_AREA_PADDING_PROPERTY: Record<SafeAreaSide, string> = {
	left: "paddingLeft",
	right: "paddingRight",
	top: "paddingTop",
	bottom: "paddingBottom",
};

/**
 * Pads the given physical `side` by its `env(safe-area-inset-{side})` value,
 * falling back to `fallback` (`"0px"` by default) on platforms with no safe
 * area to avoid. Sets only that one physical padding property.
 *
 * @example u.safeAreaPadding("bottom")
 * @example css({ paddingBottom: "env(safe-area-inset-bottom, 0px)" })
 * @example u.safeAreaPadding("top", "1rem")
 * @example css({ paddingTop: "env(safe-area-inset-top, 1rem)" })
 */
export function safeAreaPadding<Node extends Element = Element>(
	side: SafeAreaSide,
	fallback: string = "0px",
): UtilityMixin<Node> {
	return utility<Node>(
		() =>
			({
				[SAFE_AREA_PADDING_PROPERTY[side]]: env(`safe-area-inset-${side}`, fallback),
			}) as CSSStyles,
	);
}
