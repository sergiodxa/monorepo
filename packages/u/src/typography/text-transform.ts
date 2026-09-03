/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

export type TextTransformValue =
	| "none"
	| "capitalize"
	| "uppercase"
	| "lowercase"
	| "full-width"
	| "full-size-kana";

/**
 * Applies `text-transform`.
 *
 * @example u.textTransform("uppercase")
 * @example css({ textTransform: "uppercase" })
 */
export function textTransform<Node extends Element = Element>(value: TextTransformValue) {
	return utility<Node>(() => ({ textTransform: value }));
}
