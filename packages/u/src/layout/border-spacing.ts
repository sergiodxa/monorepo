/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Applies the `border-spacing` property — the gap between adjacent table
 * cell borders when `border-collapse: separate` is in effect (its default).
 *
 * @example u.borderSpacing("0.5rem")
 * @example css({ borderSpacing: "0.5rem" })
 * @example u.borderSpacing("0.5rem 1rem")
 * @example css({ borderSpacing: "0.5rem 1rem" })
 */
export function borderSpacing<Node extends Element = Element>(value: string) {
	return utility<Node>(() => ({ borderSpacing: value }));
}
