/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSStyles } from "../internal/css-styles";
import type { UtilityMixin } from "../internal/descriptor";
import type { ColorValue } from "../types";

import { var as varUtility } from "../general/var";
import { utility } from "../internal/descriptor";
import { color } from "../internal/tokens";

/**
 * Sets only `outline-color`, leaving `outline-width`/`outline-style`
 * untouched. Same color resolution as `u.outline()`'s `color` option —
 * called with no argument it resolves the system default ring color. Use
 * this over `u.outline()` when a state (e.g. `[aria-invalid]`) needs to tint
 * the outline color without forcing a width/style that wasn't already set.
 *
 * @example u.outlineColor()
 * @example css({ outlineColor: "var(--ui-ring, Highlight)" })
 * @example u.outlineColor("danger")
 * @example css({ outlineColor: "var(--ui-danger-ring)" })
 */
export function outlineColor<Node extends Element = Element>(
	value?: ColorValue | (string & {}),
): UtilityMixin<Node> {
	return utility<Node>(
		() =>
			({
				outlineColor: value ? color(value, "ring") : varUtility("ui-ring", "Highlight"),
			}) as CSSStyles,
	);
}
