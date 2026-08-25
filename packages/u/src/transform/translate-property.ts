/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Sets the standalone `translate` property outright, since at most one
 * value is ever active at a time. Accepts raw CSS shorthand — offsets or a
 * keyword like `none` — for percentages and multi-axis values.
 *
 * @example u.translateProperty("-50% 0")
 * @example css({ translate: "-50% 0" })
 */
export function translateProperty<Node extends Element = Element>(value: string) {
	return utility<Node>(() => ({ translate: value }));
}
