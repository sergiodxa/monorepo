/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

/** What happens once a scroll container reaches the end of its own scrollable area. */
export type OverscrollBehaviorValue = "auto" | "contain" | "none";

/**
 * Applies `overscroll-behavior`, defaulting to `"contain"`: a scroll past the
 * end stays inside this element and the platform affordance — iOS
 * rubber-banding, Android pull-to-refresh — survives. `"none"` suppresses it.
 *
 * @example u.overscrollBehavior()
 * @example css({ overscrollBehavior: "contain" })
 * @example u.overscrollBehavior("none")
 * @example css({ overscrollBehavior: "none" })
 */
export function overscrollBehavior<Node extends Element = Element>(
	value: OverscrollBehaviorValue = "contain",
) {
	return utility<Node>(() => ({ overscrollBehavior: value }));
}
