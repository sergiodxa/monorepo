/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

export type UserSelectValue = "none" | "auto" | "text" | "all" | "contain";

/**
 * Applies `user-select`. Defaults to `"none"`, the common case of a label,
 * icon, or drag handle that shouldn't get highlighted by an incidental
 * click-drag.
 *
 * @example u.userSelect()
 * @example css({ userSelect: "none" })
 * @example u.userSelect("text")
 * @example css({ userSelect: "text" })
 */
export function userSelect<Node extends Element = Element>(value: UserSelectValue = "none") {
	return utility<Node>(() => ({ userSelect: value }));
}
