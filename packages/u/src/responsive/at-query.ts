/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { compose, nest } from "../internal/descriptor";

/**
 * The raw escape hatch for `u.at()`'s token-resolved container query — for a
 * condition `u.at()` can't express at all, such as one querying `height`,
 * `orientation` or a style feature, or one combining several features with
 * `and`/`or`. `query` is used verbatim as the full `@container` condition,
 * named-ancestor segment and all when one is needed
 * (`"sidebar (min-width: 40rem)"`) — `u.at()` covers the ordinary
 * inline-size case, named step or one-off length alike.
 *
 * @example u.atQuery("(min-width: 40rem)", u.p(6))
 * @example css({ "@container (min-width: 40rem)": { padding: "..." } })
 * @example u.atQuery("sidebar (min-width: 40rem)", u.p(6))
 * @example css({ "@container sidebar (min-width: 40rem)": { padding: "..." } })
 */
export function atQuery<Node extends Element = Element>(
	query: string,
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return compose(input, (styles) => nest(`@container ${query}`, styles));
}
