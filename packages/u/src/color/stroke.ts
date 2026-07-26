/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ColorValue } from "../types";

import { var as varUtility } from "../general/var";
import { utility } from "../internal/descriptor";
import { color } from "../internal/tokens";

/**
 * Applies `stroke` — the SVG paint property a `<path>`/`<circle>`/`<line>`
 * shape reads its outline color from, the same semantic-tone resolution
 * `u.fill()` uses for `fill`. Called with no value it resolves the tiny
 * system default (`var(--ui-fg, CanvasText)`); called with a bare tone it
 * defaults to that tone's plain `fg` weight.
 *
 * @example u.stroke()
 * @example css({ stroke: "var(--ui-fg, CanvasText)" })
 * @example u.stroke("neutral.tint")
 * @example css({ stroke: "var(--ui-neutral-bg-tint)" })
 * @example u.stroke("brand")
 * @example css({ stroke: "var(--ui-brand-fg)" })
 */
export function stroke<Node extends Element = Element>(value?: ColorValue | (string & {})) {
	return utility<Node>(() => ({
		stroke: value ? color(value, "fg") : varUtility("ui-fg", "CanvasText"),
	}));
}
