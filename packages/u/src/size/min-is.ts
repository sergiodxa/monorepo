/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SizeValue } from "../internal/tokens";

import { utility } from "../internal/descriptor";
import { boxLength } from "../internal/tokens";

/**
 * Applies `min-inline-size`.
 *
 * @example u.minIs(0)
 * @example css({ minInlineSize: "calc(var(--ui-spacing, 0.25rem) * 0)" })
 */
export function minIs<Node extends Element = Element>(value: SizeValue) {
	return utility<Node>(() => ({ minInlineSize: boxLength(value) }));
}
