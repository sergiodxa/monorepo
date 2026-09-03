/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor.js";

import { when } from "./when.js";

/**
 * Sugar over `when('&:read-only, &[aria-readonly="true"]', input)`, matching
 * native and ARIA read-only controls. They stay focusable and keep submitting
 * their value with the form, so give them a flat, normal-but-static style.
 *
 * @example u.readOnly(u.bg("neutral.tint"))
 * @example css({ '&:read-only, &[aria-readonly="true"]': { backgroundColor: "..." } })
 * @see u.disabled() removes the control from focus and drops its value from
 * the submission entirely.
 */
export function readOnly<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return when<Node>('&:read-only, &[aria-readonly="true"]', input);
}
