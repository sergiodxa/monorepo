/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

export type BorderCollapseValue = "collapse" | "separate";

/**
 * Applies `border-collapse`. Defaults to `"collapse"`, the common case of a
 * table whose cell borders should merge into single lines instead of
 * doubling up.
 *
 * @example u.borderCollapse()
 * @example css({ borderCollapse: "collapse" })
 * @example u.borderCollapse("separate")
 * @example css({ borderCollapse: "separate" })
 */
export function borderCollapse<Node extends Element = Element>(
	value: BorderCollapseValue = "collapse",
) {
	return utility<Node>(() => ({ borderCollapse: value }));
}
