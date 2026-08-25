/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ColorValue } from "../types";

import { var as varUtility } from "../general/var";
import { utility } from "../internal/descriptor";
import { color } from "../internal/tokens";

/**
 * Applies the SVG `fill` paint property, resolving semantic tones the same way
 * `color` does. With no value it resolves the system default
 * (`var(--ui-fg, CanvasText)`); a bare tone resolves that tone's `fg` weight.
 *
 * @example u.fill()
 * @example css({ fill: "var(--ui-fg, CanvasText)" })
 * @example u.fill("neutral.tint")
 * @example css({ fill: "var(--ui-neutral-bg-tint)" })
 * @example u.fill("brand")
 * @example css({ fill: "var(--ui-brand-fg)" })
 * @example u.fill("none")
 * @example css({ fill: "none" })
 */
export function fill<Node extends Element = Element>(value?: ColorValue | (string & {})) {
	return utility<Node>(() => ({
		fill:
			value === "none" ? "none" : value ? color(value, "fg") : varUtility("ui-fg", "CanvasText"),
	}));
}
