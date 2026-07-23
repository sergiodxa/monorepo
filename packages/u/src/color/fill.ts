/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ColorValue } from "../types";

import { var as varUtility } from "../general/var";
import { utility } from "../internal/descriptor";
import { color } from "../internal/tokens";

/**
 * Applies `fill` — the SVG paint property a `<path>`/`<svg>` shape reads its
 * color from, the same semantic-tone resolution `u.fg()` uses for `color`.
 * Called with no value it resolves the tiny system default
 * (`var(--ui-fg, CanvasText)`); called with a bare tone it defaults to that
 * tone's plain `fg` weight.
 *
 * @example u.fill()
 * @example css({ fill: "var(--ui-fg, CanvasText)" })
 * @example u.fill("neutral.tint")
 * @example css({ fill: "var(--ui-neutral-bg-tint)" })
 * @example u.fill("brand")
 * @example css({ fill: "var(--ui-brand-fg)" })
 */
export function fill<Node extends Element = Element>(value?: ColorValue | (string & {})) {
	return utility<Node>(() => ({
		fill: value ? color(value, "fg") : varUtility("ui-fg", "CanvasText"),
	}));
}
