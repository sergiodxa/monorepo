/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * The `will-change` keywords plus the CSS property names most commonly hinted
 * ahead of an animation. The `(string & {})` member keeps the type a plain
 * string, so autocomplete covers those cases while any value stays accepted.
 */
export type WillChangeValue =
	| "auto"
	| "scroll-position"
	| "contents"
	| "transform"
	| "opacity"
	| "filter"
	| "backdrop-filter"
	| "box-shadow"
	| "clip-path"
	| "left"
	| "right"
	| "top"
	| "bottom"
	| "width"
	| "height"
	| "background-color"
	| "color"
	| "content"
	| (string & {});

/**
 * Applies `will-change`, hinting the browser to optimize for an upcoming
 * animation on the given property/properties before it starts.
 *
 * @example u.willChange("transform")
 * @example css({ willChange: "transform" })
 * @example u.willChange("opacity, transform")
 * @example css({ willChange: "opacity, transform" })
 */
export function willChange<Node extends Element = Element>(value: WillChangeValue) {
	return utility<Node>(() => ({ willChange: value }));
}
