/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SizeValue } from "../internal/tokens";

import { utility } from "../internal/descriptor";
import { boxLength } from "../internal/tokens";

/**
 * Applies `flex-basis`. Defaults to `"auto"`, matching `flex-basis`'s own
 * initial value — the common case of a `flex: N N M` shorthand's remainder,
 * once `u.grow()`/`u.shrink()` have been extracted from it, becoming a real
 * utility call in its own right.
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
