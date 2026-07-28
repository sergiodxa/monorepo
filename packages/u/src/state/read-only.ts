/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { when } from "./when";

/**
 * Sugar over `when('&:read-only, &[aria-readonly="true"]', input)`, matching
 * both native read-only controls and ARIA read-only custom widgets.
 *
 * Read-only is not disabled, and should not look like it. A read-only control
 * is still focusable, still reachable by keyboard, still submits its value with
 * the form, and is still announced with its label and contents — the user just
 * cannot edit it. `u.disabled()` covers the other case, where the control is
 * inert and its value is dropped from the submission entirely. Style read-only
 * as normal-but-static (flat background, no editable affordance), not as
 * greyed-out.
 *
 * @example u.readOnly(u.bg("neutral.tint"))
 * @example css({ '&:read-only, &[aria-readonly="true"]': { backgroundColor: "..." } })
 */
export function readOnly<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return when<Node>('&:read-only, &[aria-readonly="true"]', input);
}
