/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Applies `flex-grow`. Defaults to `1`, the common case of a flexible item —
 * a content area next to a fixed-size sidebar or icon — that should expand
 * to fill whatever room is left in its flex container.
 *
 * @example u.grow()
 * @example css({ flexGrow: "1" })
 * @example u.grow(0)
 * @example css({ flexGrow: "0" })
 */
export function grow<Node extends Element = Element>(value: number | (string & {}) = 1) {
	return utility<Node>(() => ({ flexGrow: String(value) }));
}
