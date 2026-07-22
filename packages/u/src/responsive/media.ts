/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { compose, nest } from "../internal/descriptor";

/**
 * The explicit escape hatch for a real viewport/feature media query, for the
 * rare rule that must read the viewport or a user preference rather than a
 * container — `u.at()` covers ordinary responsive layout instead.
 *
 * @example u.media("(prefers-contrast: more)", u.border("brand.strong"))
 * @example css({ "@media (prefers-contrast: more)": { borderColor: "..." } })
 */
export function media<Node extends Element = Element>(
	query: string,
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return compose(input, (styles) => nest(`@media ${query}`, styles));
}
