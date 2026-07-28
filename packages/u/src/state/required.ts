/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { when } from "./when";

/**
 * Sugar over `when('&:required, &[aria-required="true"]', input)`, matching
 * both native required controls and ARIA required custom widgets.
 *
 * Whatever visual marker this paints must not be the only signal that the field
 * is required: a colour change conveys nothing to anyone who cannot see it, and
 * a bare asterisk conveys nothing on its own either. Keep the requirement in
 * the label text (or an explicit hint) as well, and let this wrapper handle the
 * decoration only.
 *
 * Pairs with `u.invalid()`, which deliberately matches `:user-invalid` rather
 * than `:invalid` — so an untouched empty required field is styled as required
 * without also being styled as an error before the user has done anything.
 *
 * @example u.required(u.fg("danger"))
 * @example css({ '&:required, &[aria-required="true"]': { color: "..." } })
 */
export function required<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return when<Node>('&:required, &[aria-required="true"]', input);
}
