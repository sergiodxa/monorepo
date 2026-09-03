/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor.js";

import { media } from "./media.js";

/**
 * Sugar over `media("(prefers-contrast: less)", input)`.
 *
 * Browser support for this query lags behind `contrastMore`, so keep a base
 * declaration alongside it to cover browsers that ignore the query.
 *
 * @example u.contrastLess(u.border("neutral"))
 * @example css({ "@media (prefers-contrast: less)": { borderColor: "var(--ui-neutral-border)" } })
 */
export function contrastLess<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return media("(prefers-contrast: less)", input);
}
