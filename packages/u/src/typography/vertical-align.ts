/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

export type VerticalAlignValue =
	| "baseline"
	| "top"
	| "middle"
	| "bottom"
	| "text-top"
	| "text-bottom"
	| "sub"
	| "super"
	| (string & {});

/**
 * Applies `vertical-align`, e.g. for aligning an inline-block icon against
 * adjacent text.
 *
 * @example u.verticalAlign("middle")
 * @example css({ verticalAlign: "middle" })
 */
export function verticalAlign<Node extends Element = Element>(value: VerticalAlignValue) {
	return utility<Node>(() => ({ verticalAlign: value }));
}
