/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Room a scroll container sets aside for its scrollbar before one appears:
 * `"auto"` lets the scrollbar's arrival shift the content beside it,
 * `"stable"` holds the inline-end gutter, `"stable both-edges"` holds both.
 */
export type ScrollbarGutterValue = "auto" | "stable" | "stable both-edges";

/**
 * Applies `scrollbar-gutter`, defaulting to `"stable"`, so the container is
 * already the size it settles at and content holds its position the moment a
 * scrollbar appears. Takes effect on a scroll container (`u.scroll()`).
 *
 * @example u.scrollbarGutter()
 * @example css({ scrollbarGutter: "stable" })
 * @example u.scrollbarGutter("stable both-edges")
 * @example css({ scrollbarGutter: "stable both-edges" })
 * @example u.scrollbarGutter("auto")
 * @example css({ scrollbarGutter: "auto" })
 */
export function scrollbarGutter<Node extends Element = Element>(
	value: ScrollbarGutterValue = "stable",
) {
	return utility<Node>(() => ({ scrollbarGutter: value }));
}
