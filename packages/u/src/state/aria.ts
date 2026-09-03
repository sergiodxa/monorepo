/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor.js";

import { when } from "./when.js";

/**
 * Sugar over `when(...)` for an element's `aria-*` attribute selector: two
 * args match the attribute present with any value — including `"false"` —
 * while three args match a value exactly; pass `"true"` for the truthy case.
 *
 * @see checked
 * @see disabled
 * @see invalid
 * @example u.aria("selected", "true", u.bg("brand.tint"))
 * @example css({ '&[aria-selected="true"]': { backgroundColor: "..." } })
 * @example u.aria("busy", u.opacity(50))
 * @example css({ "&[aria-busy]": { opacity: 0.5 } })
 */
export function aria<Node extends Element = Element>(
	attribute: string,
	input: UtilityInput<Node>,
): UtilityMixin<Node>;
export function aria<Node extends Element = Element>(
	attribute: string,
	value: string | number,
	input: UtilityInput<Node>,
): UtilityMixin<Node>;
export function aria<Node extends Element = Element>(
	attribute: string,
	valueOrInput: string | number | Exclude<UtilityInput<Node>, 0 | "">,
	maybeInput?: UtilityInput<Node>,
): UtilityMixin<Node> {
	if (typeof valueOrInput === "string" || typeof valueOrInput === "number") {
		return when<Node>(`&[aria-${attribute}="${valueOrInput}"]`, maybeInput);
	}
	return when<Node>(`&[aria-${attribute}]`, valueOrInput);
}
