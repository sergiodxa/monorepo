/**
 * The `typewriterText()` style-mixin factory: paints the text a `Typewriter` has not revealed
 * yet transparent, in the host and every element inside it, so the text holds its final layout
 * while it types out.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ElementProps, MixinDescriptor } from "remix/component";

import { combine, raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";

import type { CSSStyles } from "../utils/css-styles.js";

import { TYPEWRITER_HIGHLIGHT } from "../utils/typewriter.js";

/**
 * Hides the unrevealed text of every `Typewriter` typing inside the host. A text shadow would
 * still show the hidden glyphs, so it goes too.
 *
 * @returns A `css()` mixin ready for the host element's `mix` prop.
 * @example <p mix={[typewriterText()]}>{text}</p>
 */
export function typewriterText<Node extends Element = Element>(): MixinDescriptor<
	Node,
	[styles: CSSStyles],
	ElementProps
> {
	return combine<Node>([
		when<Node>(
			`&::highlight(${TYPEWRITER_HIGHLIGHT}), & ::highlight(${TYPEWRITER_HIGHLIGHT})`,
			raw<Node>({ color: "transparent", textShadow: "none" }),
		),
	]);
}
