/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SpacingValue } from "../internal/tokens.js";

import { resolveEdge } from "../internal/box.js";
import { utility } from "../internal/descriptor.js";

/**
 * Applies `padding-inline`. One value applies both inline edges; two values
 * map to inline-start then inline-end.
 *
 * @example u.pi(4)
 * @example css({ paddingInline: "calc(var(--ui-spacing, 0.25rem) * 4)" })
 */
export function pi<Node extends Element = Element>(...values: SpacingValue[]) {
	return utility<Node>(() => ({ paddingInline: resolveEdge(values) }));
}
