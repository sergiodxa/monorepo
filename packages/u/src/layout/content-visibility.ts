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
 * Applies `content-visibility` so the browser skips rendering work for an
 * element's contents; defaults to `"auto"`. Long scrollable lists want
 * {@link virtualize}, which also reserves a placeholder size for the scrollbar.
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
