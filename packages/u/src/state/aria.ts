/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { when } from "./when";

/**
 * Sugar over `when(...)` for an element's own `aria-*` attribute selector:
 * targets `&[aria-{attribute}]` (present with any value) when no `value` is
 * given, or `&[aria-{attribute}="{value}"]` when one is.
 *
 * `checked()`, `disabled()`, and `invalid()` already bundle the common ARIA
 * states with their native equivalents, so this wrapper is for the rest —
 * `aria-expanded`, `aria-selected`, `aria-current`, `aria-pressed`,
 * `aria-busy`, `aria-sort`.
 *
 * The three-argument form matches the attribute value as an exact string, so
 * it cannot express "any value except `false`": `aria("expanded", input)`
 * matches an `aria-expanded="false"` element too, because the attribute is
 * present. Target the truthy state explicitly with
 * `aria("expanded", "true", input)`.
 *
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
	valueOrInput: string | number | UtilityInput<Node>,
	maybeInput?: UtilityInput<Node>,
): UtilityMixin<Node> {
	if (maybeInput === undefined) {
		return when<Node>(`&[aria-${attribute}]`, valueOrInput as UtilityInput<Node>);
	}
	return when<Node>(`&[aria-${attribute}="${valueOrInput}"]`, maybeInput);
}
