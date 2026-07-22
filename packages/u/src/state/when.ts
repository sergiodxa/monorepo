/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { compose, nest } from "../internal/descriptor";

/**
 * The primitive selector wrapper. Flattens `input`, merges the flattened
 * utilities' style trees, and nests the merged tree under `selector` — the
 * primitive every other state wrapper (`hover()`, `checked()`, ...) is sugar
 * over.
 *
 * @example u.when("&:has(input:checked)", [u.bg("brand.tint"), u.border("brand")])
 * @example css({ "&:has(input:checked)": { backgroundColor: "...", borderColor: "..." } })
 */
export function when<Node extends Element = Element>(
	selector: string,
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return compose(input, (styles) => nest(selector, styles));
}
