/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { compose, nest } from "../internal/descriptor";

/**
 * The literal escape hatch for `u.at()`'s token-resolved container query —
 * for the rare one-off `@container` breakpoint that was never part of the
 * named scale (`"40rem"`, not `"md"`) and must never be wrapped in
 * `var(--ui-container-*, fallback)`. `query` is used verbatim as the full
 * `@container` condition, named-ancestor segment and all when one is needed
 * (`"sidebar (min-width: 40rem)"`) — `u.at()` covers the ordinary
 * named-token case instead.
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
