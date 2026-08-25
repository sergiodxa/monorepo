/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { when } from "./when";

/**
 * Sugar over `when('&:disabled, &[aria-disabled="true"]', input)`, applying
 * the given utilities under both the native and ARIA disabled selectors.
 * Callers choose the actual colors, opacity, and cursor for that state.
 *
 * @example u.disabled(u.opacity(50))
 * @example css({ '&:disabled, &[aria-disabled="true"]': { opacity: 0.5 } })
 */
export function disabled<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return when('&:disabled, &[aria-disabled="true"]', input);
}
