/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

/** Accepted `align-items` keywords, shared with `u.self()`, `u.place()`, `u.hstack()`, `u.vstack()`, and `u.zstack()`. */
export type AlignItemsValue = "start" | "center" | "end" | "stretch" | "baseline";

/**
 * Sets `align-items`.
 *
 * @example u.items("center")
 * @example css({ alignItems: "center" })
 */
export function items<Node extends Element = Element>(value: AlignItemsValue = "stretch") {
	return utility<Node>(() => ({ alignItems: value }));
}
