/**
 * The border, tinted background, and emphasized foreground a bordered,
 * tinted panel — a full-width status message or placeholder panel — takes on
 * for each of the five semantic color roles, one `&[data-color="..."]`
 * branch per role, every branch driven by that color's own `--ui-*`
 * variables rather than a hardcoded value.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ElementProps, MixinDescriptor } from "remix/ui";

import { bg, border, fg } from "@pkg/u/color";
import { combine } from "@pkg/u/general";
import { when } from "@pkg/u/state";

import type { CSSStyles } from "../utils/css-styles";
import type { SemanticColor } from "../utils/semantic-color";

/**
 * Every {@link SemanticColor}, in the order {@link semanticColorPanel} emits
 * its branches.
 */
const SEMANTIC_COLORS: readonly SemanticColor[] = [
	"brand",
	"neutral",
	"success",
	"warning",
	"danger",
];

/**
 * Composes every `&[data-color="..."]` branch a tinted panel keys its
 * border, background, and foreground on, one branch per {@link SemanticColor},
 * as its own mixin built from `@pkg/u`'s `border()`/`bg()`/`fg()` color
 * utilities nested under `when()`. Compose the call directly in a host's
 * `mix` array, alongside a `css()` call for
 * whatever border radius, layout, or other declarations are genuinely local
 * to that panel, rather than folding its properties into another `css()`
 * call.
 *
 * @returns A `css()` mixin ready for a host element's `mix` prop.
 * @example
 * <div
 * 	data-color="danger"
 * 	mix={[
 * 		semanticColorPanel(),
 * 		css({
 * 			display: "flex",
 * 			borderRadius: "var(--ui-radius-lg, 0.5rem)",
 * 		}),
 * 	]}
 * >
 * 	{children}
 * </div>;
 */
export function semanticColorPanel<Node extends Element = Element>(): MixinDescriptor<
	Node,
	[styles: CSSStyles],
	ElementProps
> {
	return combine<Node>(
		SEMANTIC_COLORS.map((color) =>
			when<Node>(`&[data-color="${color}"]`, [
				border<Node>(`${color}.border`),
				bg<Node>(`${color}.tint`),
				fg<Node>(`${color}.emphasis`),
			]),
		),
	);
}
