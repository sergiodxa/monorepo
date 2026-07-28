/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Whether the element's contents are rendered normally (`"visible"`, the CSS
 * default), skipped while off-screen (`"auto"`), or always skipped
 * (`"hidden"`).
 */
export type ContentVisibilityValue = "visible" | "auto" | "hidden";

/**
 * Applies `content-visibility`, letting the browser skip rendering work for an
 * element's contents. Defaults to `"auto"`, which skips that work while the
 * element is off-screen and does it as it scrolls into view.
 *
 * This is the bare primitive. For the long-scrollable-list case, prefer
 * {@link virtualize}, which stays the recommended pattern because it sets
 * `content-visibility: auto` *and* a `contain-intrinsic-size` placeholder —
 * without a reserved size the skipped content measures as zero, so the
 * scrollbar jumps around as off-screen content mounts and unmounts. Reach for
 * this utility directly only when a placeholder size genuinely doesn't apply,
 * or when you're setting one of the other two values.
 *
 * `"hidden"` always skips the contents, and skipping them takes them out of
 * the accessibility tree and out of find-in-page as well — a screen reader
 * won't announce them and Ctrl/Cmd+F won't match them. That makes it very
 * close to `u.hidden()`; the one difference is that the element's own box is
 * still generated and laid out, so it keeps occupying space and can be revealed
 * without a reflow of everything around it, whereas `display: none` removes the
 * box entirely.
 *
 * @example u.contentVisibility()
 * @example css({ contentVisibility: "auto" })
 * @example u.contentVisibility("hidden")
 * @example css({ contentVisibility: "hidden" })
 * @example u.contentVisibility("visible")
 * @example css({ contentVisibility: "visible" })
 */
export function contentVisibility<Node extends Element = Element>(
	value: ContentVisibilityValue = "auto",
) {
	return utility<Node>(() => ({ contentVisibility: value }));
}
