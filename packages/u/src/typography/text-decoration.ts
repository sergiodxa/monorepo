/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

export type TextDecorationLineValue = "none" | "underline" | "overline" | "line-through";

/**
 * Applies `text-decoration-line`.
 *
 * @example u.textDecoration("underline")
 * @example css({ textDecorationLine: "underline" })
 */
export function textDecoration<Node extends Element = Element>(value: TextDecorationLineValue) {
	return utility<Node>(() => ({ textDecorationLine: value }));
}
