/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { when } from "./when";

/**
 * Waits for user interaction before flagging a field invalid, matching
 * `:user-invalid` alongside the ARIA fallback so validation only surfaces
 * once it is meaningful to the person filling in the field.
 *
 * @example u.invalid(u.border("danger"))
 * @example css({ '&:user-invalid, &[aria-invalid="true"]': { borderColor: "..." } })
 */
export function invalid<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return when('&:user-invalid, &[aria-invalid="true"]', input);
}
