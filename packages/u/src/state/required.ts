/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor.js";

import { when } from "./when.js";

/**
 * Sugar over `when('&:required, &[aria-required="true"]', input)`, matching
 * required controls and widgets. Add a textual cue in the label too, since
 * colour and a bare asterisk alone only reach sighted users.
 *
 * @example u.required(u.fg("danger"))
 * @example css({ '&:required, &[aria-required="true"]': { color: "..." } })
 * @see u.invalid() pairs by matching `:user-invalid`, so an untouched
 * required field stays looking valid until the user interacts with it.
 */
export function required<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return when<Node>('&:required, &[aria-required="true"]', input);
}
