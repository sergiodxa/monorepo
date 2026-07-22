/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Sets the host element's `z-index` from a plain number. Only numbers are
 * accepted — this package doesn't define named component layers such as
 * `"toast"` or `"modal"`, since stacking order for those is an app or
 * component concern, not a lower-level styling primitive.
 *
 * @example u.z(10)
 * @example css({ zIndex: 10 })
 */
export function z<Node extends Element = Element>(value: number) {
	return utility<Node>(() => ({ zIndex: value }));
}
