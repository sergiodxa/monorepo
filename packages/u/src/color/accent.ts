/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ColorValue } from "../types";

import { utility } from "../internal/descriptor";
import { color } from "../internal/tokens";

/**
 * Applies `accent-color`, the property native form controls (`checkbox`,
 * `radio`, `range`, `progress`) read for their own painted color. Defaults
 * to the brand solid color so a bare `u.accent()` always resolves.
 *
 * @example u.accent()
 * @example css({ accentColor: "var(--ui-brand-bg-solid)" })
 * @example u.accent("danger")
 * @example css({ accentColor: "var(--ui-danger-bg-solid)" })
 */
export function accent<Node extends Element = Element>(
	value: ColorValue | (string & {}) = "brand",
) {
	return utility<Node>(() => ({ accentColor: color(value, "bg-solid") }));
}
