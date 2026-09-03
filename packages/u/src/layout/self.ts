/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

import type { AlignItemsValue } from "./items.js";

/** Accepted `align-self` keywords: {@link AlignItemsValue} plus `"auto"` to defer to the container's `align-items`. */
export type AlignSelfValue = AlignItemsValue | "auto";

/**
 * Sets `align-self`.
 *
 * @example u.self("center")
 * @example css({ alignSelf: "center" })
 */
export function self<Node extends Element = Element>(value: AlignSelfValue = "auto") {
	return utility<Node>(() => ({ alignSelf: value }));
}
