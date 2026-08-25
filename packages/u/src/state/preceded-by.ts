/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { when } from "./when";

/**
 * Sugar over `when(":is({selector}) ~ &", input)`, the backward-looking twin
 * of `hasSibling()`. The `:is()` wrapper is load-bearing: the serializer reads
 * a bare `input:checked ~ &` key as a declaration, so wrapping keeps it a rule.
 *
 * @example u.precededBy("input:checked", u.border("brand.solid"))
 * @example css({ ":is(input:checked) ~ &": { borderColor: "var(--ui-brand-bg-solid)" } })
 * @example u.precededBy("input:focus-visible", u.outline({ color: "brand", offset: 2 }))
 * @example css({ ":is(input:focus-visible) ~ &": { outlineColor: "...", outlineOffset: "2px" } })
 */
export function precededBy<Node extends Element = Element>(
	selector: string,
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return when<Node>(`:is(${selector}) ~ &`, input);
}
