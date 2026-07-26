/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { when } from "./when";

/**
 * Sugar over an element's own `data-*` attribute selector: targets
 * `&[data-{attribute}]` (present with any value, including a bare boolean
 * attribute) when no `value` is given, or `&[data-{attribute}="{value}"]`
 * when one is.
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
	valueOrInput: string | number | UtilityInput<Node>,
	maybeInput?: UtilityInput<Node>,
): UtilityMixin<Node> {
	if (maybeInput === undefined) {
		return when<Node>(`&[data-${attribute}]`, valueOrInput as UtilityInput<Node>);
	}
	return when<Node>(`&[data-${attribute}="${valueOrInput}"]`, maybeInput);
}
