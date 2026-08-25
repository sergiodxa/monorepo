/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { compose, nest } from "../internal/descriptor";

/**
 * The raw escape hatch for expressing a container condition directly —
 * querying `height`, `orientation`, a style feature, or combining several
 * with `and`/`or`. `query` is used verbatim as the full `@container` condition.
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
