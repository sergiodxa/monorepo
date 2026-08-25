/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { compose } from "../internal/descriptor";

/**
 * Flattens `input` and merges the flattened utilities' style trees into one
 * declaration set at the host's own level, so unrelated utilities compose as
 * a single mixin with each nested selector kept as a sibling.
 *
 * @example u.combine([u.rounded("lg"), u.border({ color: "neutral", width: 1 })])
 * @example css({ borderRadius: "var(--ui-radius-lg, 0.5rem)", borderColor: "var(--ui-neutral-border)", borderWidth: "1px", borderStyle: "solid" })
 * @example u.combine([u.when("&:hover", u.bg("brand.tint")), u.when("&:focus", u.bg("brand.tint"))])
 * @example css({ "&:hover": { backgroundColor: "..." }, "&:focus": { backgroundColor: "..." } })
 */
export function combine<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return compose<Node>(input, (styles) => styles);
}
