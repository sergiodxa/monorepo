/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { TextSizeName } from "../types";

import { utility } from "../internal/descriptor";
import { text as textToken } from "../internal/tokens";

/**
 * Applies `font-size` from the named text scale (`xs` through `9xl`, or an
 * app-extended name), resolving through the same `var(--ui-text-{name},
 * fallback)` token as `u.text()`'s own font-size half — but without also
 * setting a paired `line-height`. Reach for this at a call site that
 * intentionally sets a font-size with no paired line-height at all, or one
 * that sets a different, non-scale line-height separately; `u.text()` there
 * would silently add a line-height declaration that wasn't in the original,
 * a real behavior change. `fontSize()` only ever touches one property.
 *
 * @example u.fontSize("lg")
 * @example css({ fontSize: "var(--ui-text-lg, 1.125rem)" })
 */
export function fontSize<Node extends Element = Element>(name: TextSizeName | (string & {})) {
	return utility<Node>(() => ({ fontSize: textToken(name) }));
}
