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
 * Sets `outline-color` alone, so a state such as `[aria-invalid]` can tint an
 * outline while the width and style already in effect stay in force. With no
 * argument it resolves the system default ring color.
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
