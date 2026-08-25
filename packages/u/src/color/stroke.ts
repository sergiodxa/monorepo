/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ColorValue } from "../types";

import { var as varUtility } from "../general/var";
import { utility } from "../internal/descriptor";
import { color } from "../internal/tokens";

/**
 * Applies `stroke`, resolving a semantic tone to an SVG shape's outline
 * color. With no value it resolves the system default
 * `var(--ui-fg, CanvasText)`; a bare tone resolves that tone's `fg` weight.
 *
 * @example u.stroke()
 * @example css({ stroke: "var(--ui-fg, CanvasText)" })
 * @example u.stroke("neutral.tint")
 * @example css({ stroke: "var(--ui-neutral-bg-tint)" })
 * @example u.stroke("brand")
 * @example css({ stroke: "var(--ui-brand-fg)" })
 * @example u.stroke("none")
 * @example css({ stroke: "none" })
 */
export function stroke<Node extends Element = Element>(value?: ColorValue | (string & {})) {
	return utility<Node>(() => ({
		stroke:
			value === "none" ? "none" : value ? color(value, "fg") : varUtility("ui-fg", "CanvasText"),
	}));
}
