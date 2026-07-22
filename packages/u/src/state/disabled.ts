/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { when } from "./when";

/**
 * Sugar over `when('&:disabled, &[aria-disabled="true"]', input)`. A
 * selector wrapper only — it defines no visual disabled recipe of its own,
 * so apps and components choose the actual colors, opacity, and cursor.
 *
 * @example u.disabled(u.opacity(50))
 * @example css({ '&:disabled, &[aria-disabled="true"]': { opacity: 0.5 } })
 */
export function disabled<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return when('&:disabled, &[aria-disabled="true"]', input);
}
