/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * A flexible spacer: grows and shrinks to fill whatever room is left in a
 * flex container, pushing siblings on either side of it apart — a toolbar's
 * trailing action pinned to the end, or two groups split to opposite ends
 * of a row.
 *
 * @example u.spacer()
 * @example css({ flex: "1 1 auto" })
 */
export function spacer<Node extends Element = Element>() {
	return utility<Node>(() => ({ flex: "1 1 auto" }));
}
