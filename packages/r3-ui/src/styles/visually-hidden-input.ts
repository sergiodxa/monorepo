/**
 * The screen-reader-only-but-focusable clipping recipe a compound option
 * built from a native `<input>` applies to that input, so the control keeps
 * its focus, keyboard, and form-submission semantics live while a sibling
 * element paints the visible indicator the option actually shows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ElementProps, MixinDescriptor } from "remix/ui";

import { css } from "remix/ui";

import type { CSSStyles } from "../utils/css-styles";

/**
 * Composes the shared visually-hidden-input recipe as its own `css()` mixin:
 * nine declarations that clip a native input down to a `1px` by `1px` box
 * positioned absolutely out of layout flow, its padding and border removed, a
 * `-1px` margin pulling its box back to a single point, `clip: rect(0, 0, 0,
 * 0)` and `overflow: hidden` clipping its rendered pixels away, and
 * `whiteSpace: nowrap` keeping its clip rect stable regardless of surrounding
 * text wrapping. The input keeps its native focusability and tab order
 * throughout this recipe, since only its position and rendered pixels are
 * clipped away. Every compound option composes this alongside its own `mix`
 * entries in the same array, so the clipping recipe stays a disjoint sibling
 * entry rather than folded into the option's own styling.
 *
 * @returns A `css()` mixin ready for a host element's `mix` prop.
 * @example
 * <input
 *   type="radio"
 *   mix={[visuallyHiddenInput(), parts?.input]}
 * />
 */
export function visuallyHiddenInput<Node extends Element = Element>(): MixinDescriptor<
	Node,
	[styles: CSSStyles],
	ElementProps
> {
	return css<Node>({
		position: "absolute",
		inlineSize: "1px",
		blockSize: "1px",
		padding: "0",
		margin: "-1px",
		overflow: "hidden",
		clip: "rect(0, 0, 0, 0)",
		whiteSpace: "nowrap",
		borderWidth: "0",
	});
}
