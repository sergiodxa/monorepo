/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SpacingValue } from "../internal/tokens";

import { resolveEdge } from "../internal/box";
import { utility } from "../internal/descriptor";

/**
 * Applies `gap` using the spacing scale or a raw CSS length. One value
 * applies to both the row and column gap; two values are read as
 * `"{row} {column}"`.
 *
 * @example u.gap(4)
 * @example css({ gap: "calc(var(--ui-spacing, 0.25rem) * 4)" })
 * @example u.gap(2, 4)
 * @example css({ gap: "calc(var(--ui-spacing, 0.25rem) * 2) calc(var(--ui-spacing, 0.25rem) * 4)" })
 */
export function gap<Node extends Element = Element>(...values: SpacingValue[]) {
	if (values.length !== 1 && values.length !== 2) {
		throw new Error(`@pkg/u: gap() expects 1 or 2 values, got ${values.length}`);
	}
	return utility<Node>(() => ({ gap: resolveEdge(values) }));
}
