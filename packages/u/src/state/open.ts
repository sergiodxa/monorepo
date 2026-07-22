/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { when } from "./when";

/**
 * Sugar over `when("&[open], &:popover-open", input)`, matching both the
 * `<details>`/`<dialog>` `open` attribute and the Popover API's
 * `:popover-open` pseudo-class.
 *
 * @example u.open(u.opacity(100))
 * @example css({ "&[open], &:popover-open": { opacity: 1 } })
 */
export function open<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return when("&[open], &:popover-open", input);
}
