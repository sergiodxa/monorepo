/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { compose, utility } from "../internal/descriptor";
import { when } from "../state/when";

/**
 * Hides the scrollbar across Chrome/Safari, legacy Edge, and Firefox, while
 * the element stays scrollable by wheel, touch, keyboard, and script. Pair
 * with `u.scroll()`/`u.overflow()` on the same element.
 *
 * @example u.noScrollbar()
 * @example css({ "&::-webkit-scrollbar": { display: "none" }, msOverflowStyle: "none", scrollbarWidth: "none" })
 */
export function noScrollbar<Node extends Element = Element>() {
	return compose<Node>(
		[
			when<Node>(
				"&::-webkit-scrollbar",
				utility<Node>(() => ({ display: "none" })),
			),
			utility<Node>(() => ({ MsOverflowStyle: "none", scrollbarWidth: "none" })),
		],
		(styles) => styles,
	);
}
