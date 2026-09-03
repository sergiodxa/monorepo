/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SizeValue } from "../internal/tokens.js";

import { utility } from "../internal/descriptor.js";
import { boxLength } from "../internal/tokens.js";

/**
 * Applies `flex-basis`, defaulting to `"auto"` to match the property's own
 * initial value — the remainder of a `flex: N N M` shorthand once
 * `u.grow()`/`u.shrink()` have been extracted from it.
 *
 * @example u.basis()
 * @example css({ flexBasis: "auto" })
 * @example u.basis("0%")
 * @example css({ flexBasis: "0%" })
 * @example u.basis(4)
 * @example css({ flexBasis: "calc(var(--ui-spacing, 0.25rem) * 4)" })
 */
export function basis<Node extends Element = Element>(value: SizeValue = "auto") {
	return utility<Node>(() => ({ flexBasis: boxLength(value) }));
}
