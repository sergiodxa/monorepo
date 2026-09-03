/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SpacingValue } from "../internal/tokens.js";

import { resolveEdge } from "../internal/box.js";
import { utility } from "../internal/descriptor.js";

/**
 * Applies `padding-block`. One value applies both block edges; two values
 * map to block-start then block-end.
 *
 * @example u.pb(4)
 * @example css({ paddingBlock: "calc(var(--ui-spacing, 0.25rem) * 4)" })
 */
export function pb<Node extends Element = Element>(...values: SpacingValue[]) {
	return utility<Node>(() => ({ paddingBlock: resolveEdge(values) }));
}
