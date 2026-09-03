/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor.js";

import { when } from "./when.js";

/**
 * Sugar over an element's own `data-*` attribute selector: matches
 * `&[data-{attribute}]` (any value, including a bare boolean attribute) with no
 * `value` argument, or `&[data-{attribute}="{value}"]` with one.
 *
 * @example u.data("orientation", "vertical", u.flexCol())
 * @example css({ '&[data-orientation="vertical"]': { flexDirection: "column" } })
 * @example u.data("disabled", u.opacity(50))
 * @example css({ "&[data-disabled]": { opacity: 0.5 } })
 */
export function data<Node extends Element = Element>(
	attribute: string,
	input: UtilityInput<Node>,
): UtilityMixin<Node>;
export function data<Node extends Element = Element>(
	attribute: string,
	value: string | number,
	input: UtilityInput<Node>,
): UtilityMixin<Node>;
export function data<Node extends Element = Element>(
	attribute: string,
	valueOrInput: string | number | Exclude<UtilityInput<Node>, 0 | "">,
	maybeInput?: UtilityInput<Node>,
): UtilityMixin<Node> {
	if (typeof valueOrInput === "string" || typeof valueOrInput === "number") {
		return when<Node>(`&[data-${attribute}="${valueOrInput}"]`, maybeInput);
	}
	return when<Node>(`&[data-${attribute}]`, valueOrInput);
}
