/**
 * The muted caption typography shared by every live readout rendered through
 * a native `<output>` element: a small point size, a matching line height,
 * and the neutral muted foreground color.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ElementProps, MixinDescriptor } from "remix/ui";

import { fg } from "@pkg/u/color";
import { combine, raw } from "@pkg/u/general";

import type { CSSStyles } from "../utils/css-styles";

/**
 * A `0.875rem` run of text at a `1.25`-to-`0.875` line height, colored the
 * neutral muted foreground — the three properties every `<output>` live
 * readout host styles itself with. Composed directly in a host's `mix` array
 * alongside a `css()` call for whatever styling is genuinely local to that
 * host, so every readout stays visually identical without repeating the same
 * three values in each host module.
 *
 * @returns A `css()` mixin ready for a host element's `mix` prop.
 * @example
 * <output mix={[outputCaptionText(), mix]}>{value}</output>;
 */
export function outputCaptionText<Node extends Element = Element>(): MixinDescriptor<
	Node,
	[styles: CSSStyles],
	ElementProps
> {
	return combine<Node>([
		// `@pkg/u`'s `text()` size scale always wraps its value in a
		// `var(--ui-text-*, ...)` reference; this host's literal `0.875rem`
		// point size and bespoke `calc()` line height carry no such variable,
		// so both stay raw declarations rather than a mismatched migration.
		raw({ fontSize: "0.875rem", lineHeight: "calc(1.25 / 0.875)" }),
		fg("neutral"),
	]);
}
