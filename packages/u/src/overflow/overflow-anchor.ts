/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/** Whether an element may be picked as the browser's scroll anchor. */
export type OverflowAnchorValue = "auto" | "none";

/**
 * Applies `overflow-anchor`, the browser's choice of which element holds the
 * scroll position steady as content above it resizes. The `"none"` default
 * suits infinite-scroll sentinels, whose own growth fights anchoring.
 *
 * @example u.overflowAnchor()
 * @example css({ overflowAnchor: "none" })
 * @example u.overflowAnchor("auto")
 * @example css({ overflowAnchor: "auto" })
 */
export function overflowAnchor<Node extends Element = Element>(
	value: OverflowAnchorValue = "none",
) {
	return utility<Node>(() => ({ overflowAnchor: value }));
}
