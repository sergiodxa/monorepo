/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ColorValue } from "../types";

import { utility } from "../internal/descriptor";
import { color } from "../internal/tokens";

/**
 * Themes a scroll container's scrollbar via the standard `scrollbar-color`
 * property, supported by Firefox and modern Chromium alike through plain
 * CSS. Inherits down the tree, theming nested scroll containers too.
 *
 * @param thumb - Resolves through the token layer with `border` as the
 * default property. Leaving it out emits `auto`, the platform's own
 * scrollbar.
 * @param track - Resolves with `tint` as the default property. Given only
 * a `thumb`, falls back to `transparent` so the container's own background
 * shows through.
 * @see u.thinScrollbar - sets the unrelated `scrollbar-width` property;
 * combine freely for a thin, themed scrollbar.
 * @see u.noScrollbar - hides the scrollbar outright.
 * @example u.scrollbarColor()
 * @example css({ scrollbarColor: "auto" })
 * @example u.scrollbarColor("neutral")
 * @example css({ scrollbarColor: "var(--ui-neutral-border) transparent" })
 * @example u.scrollbarColor("brand.strong", "neutral")
 * @example css({ scrollbarColor: "var(--ui-brand-border-strong) var(--ui-neutral-bg-tint)" })
 * @example u.scrollbarColor("color.neutral.400", "color.neutral.100")
 * @example css({ scrollbarColor: "var(--ui-color-neutral-400) var(--ui-color-neutral-100)" })
 */
export function scrollbarColor<Node extends Element = Element>(
	thumb?: ColorValue | (string & {}),
	track?: ColorValue | (string & {}),
) {
	return utility<Node>(() => {
		if (!thumb) return { scrollbarColor: "auto" };
		let thumbColor = color(thumb, "border");
		let trackColor = track ? color(track, "tint") : "transparent";
		return { scrollbarColor: `${thumbColor} ${trackColor}` };
	});
}
