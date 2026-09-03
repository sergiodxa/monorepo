/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

export type PointerEventsValue = "auto" | "none";

/**
 * Applies `pointer-events`. Defaults to `"none"`, the common case of an
 * overlay, icon, or decorative element that should let clicks and hovers pass
 * through to whatever's underneath it.
 *
 * @example u.pointerEvents()
 * @example css({ pointerEvents: "none" })
 * @example u.pointerEvents("auto")
 * @example css({ pointerEvents: "auto" })
 */
export function pointerEvents<Node extends Element = Element>(value: PointerEventsValue = "none") {
	return utility<Node>(() => ({ pointerEvents: value }));
}
