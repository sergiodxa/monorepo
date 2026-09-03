/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { TextSizeName } from "../types.js";

import { utility } from "../internal/descriptor.js";
import { text as textToken } from "../internal/tokens.js";

/**
 * Applies `font-size` from the named text scale (`xs` through `9xl`, or an
 * app-extended name), resolving the same token as `u.text()`'s font-size
 * half but touching only `font-size`, leaving line-height fully caller-set.
 *
 * @example u.fontSize("lg")
 * @example css({ fontSize: "var(--ui-text-lg, 1.125rem)" })
 */
export function fontSize<Node extends Element = Element>(name: TextSizeName | (string & {})) {
	return utility<Node>(() => ({ fontSize: textToken(name) }));
}
