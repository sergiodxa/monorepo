/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SpacingValue } from "../internal/tokens.js";

import { resolveEdge } from "../internal/box.js";
import { utility } from "../internal/descriptor.js";

/**
 * Applies `margin-block`. One value applies both block edges; two values
 * map to block-start then block-end.
 *
 * @example u.mb(4)
 * @example css({ marginBlock: "calc(var(--ui-spacing, 0.25rem) * 4)" })
 */
export function mb<Node extends Element = Element>(...values: SpacingValue[]) {
	return utility<Node>(() => ({ marginBlock: resolveEdge(values) }));
}
