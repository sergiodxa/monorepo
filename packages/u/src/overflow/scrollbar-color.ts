/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ColorValue } from "../types";

import { utility } from "../internal/descriptor";
import { color } from "../internal/tokens";

/**
 * Themes a scroll container's scrollbar through the standard
 * `scrollbar-color` property, which takes exactly two colors — the thumb
 * first, then the track. This is the right first reach for recoloring a
 * scrollbar: it needs no pseudo-element selectors and works in Firefox and
 * modern Chromium alike, unlike the `::-webkit-scrollbar-thumb` family, which
 * is vendor-prefixed and was never supported by Firefox at all.
 *
 * `thumb` resolves through the token layer with `border` as its default
 * property, since a thumb reads as a border-weight mark over the track;
 * `track` resolves with `tint` as its default, the tone's subtle background
 * fill. With no arguments at all it emits CSS's own `auto`, leaving the
 * platform scrollbar untouched rather than inventing a token pair. Given only
 * a `thumb`, the track falls back to `transparent` — the property is invalid
 * with a single color, and a transparent track lets the container's own
 * background show through, which is almost always the intent when someone
 * only names a thumb.
 *
 * Three constraints worth knowing. It is an inherited property, so setting it
 * high in the tree themes every nested scroll container underneath unless one
 * of them overrides it. Safari does not support it as of writing, where it
 * simply degrades to the platform scrollbar rather than breaking anything.
 * And a thumb that sits at low contrast against its track erases the visual
 * cue telling a reader the region scrolls at all, so keep the two clearly
 * distinguishable.
 *
 * Composes with `u.thinScrollbar()`, which sets `scrollbar-width` — a
 * different property — so the two combine into a thin *and* themed scrollbar
 * with no conflict. It is pointless alongside `u.noScrollbar()`, which hides
 * the scrollbar outright, leaving nothing to color.
 *
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
