/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { compose, utility } from "../internal/descriptor";
import { when } from "../state/when";

/**
 * Hides the scrollbar on a scroll container across every browser engine —
 * `::-webkit-scrollbar` for Chrome/Safari, `-ms-overflow-style` for legacy
 * Edge, and `scrollbar-width` for Firefox — while leaving the element free
 * to scroll through any other input (wheel, touch, keyboard, programmatic).
 * Pair with `u.scroll()`/`u.overflow()` on the same element.
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
