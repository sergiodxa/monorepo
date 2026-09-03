/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

/**
 * Prevents text from wrapping onto multiple lines, letting it overflow its
 * box instead. Pair with {@link truncate} when overflow should end in an
 * ellipsis rather than spill out.
 *
 * @example u.nowrap()
 * @example css({ whiteSpace: "nowrap" })
 */
export function nowrap<Node extends Element = Element>() {
	return utility<Node>(() => ({ whiteSpace: "nowrap" }));
}
