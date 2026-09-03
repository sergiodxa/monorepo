/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SpacingValue } from "../internal/tokens.js";

import { resolveEdge } from "../internal/box.js";
import { utility } from "../internal/descriptor.js";

/**
 * Applies `margin-inline`. One value applies both inline edges; two values
 * map to inline-start then inline-end.
 *
 * @example u.mi(4, "auto")
 * @example css({ marginInline: "calc(var(--ui-spacing, 0.25rem) * 4) auto" })
 */
export function mi<Node extends Element = Element>(...values: SpacingValue[]) {
	return utility<Node>(() => ({ marginInline: resolveEdge(values) }));
}
