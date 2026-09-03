/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor.js";

import { compose, nest } from "../internal/descriptor.js";

/**
 * A feature-query wrapper, applying the given utilities only when the
 * browser supports `query` — progressive enhancement for CSS features
 * without a reliable fallback path other than "don't apply this at all".
 *
 * @example u.supports("(corner-shape: squircle)", u.corner("squircle"))
 * @example css({ "@supports (corner-shape: squircle)": { cornerShape: "squircle" } })
 */
export function supports<Node extends Element = Element>(
	query: string,
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return compose(input, (styles) => nest(`@supports ${query}`, styles));
}
