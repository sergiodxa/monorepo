/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { when } from "./when";

/**
 * Sugar over `when('&:user-invalid, &[aria-invalid="true"]', input)`. A
 * selector wrapper only — it defines no visual invalid recipe of its own.
 *
 * @example u.invalid(u.border("danger"))
 * @example css({ '&:user-invalid, &[aria-invalid="true"]': { borderColor: "..." } })
 */
export function invalid<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return when('&:user-invalid, &[aria-invalid="true"]', input);
}
