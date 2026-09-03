/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SizeValue } from "../internal/tokens.js";

import { utility } from "../internal/descriptor.js";
import { boxLength } from "../internal/tokens.js";

/**
 * Applies `min-inline-size`.
 *
 * @example u.minIs(0)
 * @example css({ minInlineSize: "calc(var(--ui-spacing, 0.25rem) * 0)" })
 */
export function minIs<Node extends Element = Element>(value: SizeValue) {
	return utility<Node>(() => ({ minInlineSize: boxLength(value) }));
}
