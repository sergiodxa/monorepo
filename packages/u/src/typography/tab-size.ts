/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Applies `tab-size`. A bare number is stringified so it stays unitless — CSS
 * would otherwise read it as a `px` length — while a string such as `"4ch"`
 * passes through unchanged as a CSS length.
 *
 * @example u.tabSize()
 * @example css({ tabSize: "2" })
 * @example u.tabSize(4)
 * @example css({ tabSize: "4" })
 * @example u.tabSize("4ch")
 * @example css({ tabSize: "4ch" })
 */
export function tabSize<Node extends Element = Element>(value: number | (string & {}) = 2) {
	return utility<Node>(() => ({ tabSize: String(value) }));
}
