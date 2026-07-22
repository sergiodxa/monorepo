/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ColorValue } from "../types";

import { var as varUtility } from "../general/var";
import { utility } from "../internal/descriptor";
import { color } from "../internal/tokens";

/**
 * Applies `color` (foreground text color). Called with no value it resolves
 * the tiny system default (`var(--ui-fg, CanvasText)`); called with a bare
 * tone it defaults to that tone's plain `fg` weight.
 *
 * @example u.fg()
 * @example css({ color: "var(--ui-fg, CanvasText)" })
 * @example u.fg("brand.muted")
 * @example css({ color: "var(--ui-brand-fg-muted)" })
 * @example u.fg("brand")
 * @example css({ color: "var(--ui-brand-fg)" })
 */
export function fg<Node extends Element = Element>(value?: ColorValue | (string & {})) {
	return utility<Node>(() => ({
		color: value ? color(value, "fg") : varUtility("ui-fg", "CanvasText"),
	}));
}
