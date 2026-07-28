/**
 * Shared logical-box-shorthand resolution behind `p()`, `m()`,
 * `scrollPadding()`, and `scrollMargin()`: the 1/2/4-value overload that maps
 * onto logical directions instead of physical ones.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSStyles } from "./css-styles";
import type { SpacingValue } from "./tokens";

import { spacing } from "./tokens";

/**
 * Resolves a 1, 2, or 4-value logical box shorthand for `padding`, `margin`,
 * `scroll-padding`, or `scroll-margin`. One value applies uniformly; two
 * values map to block then inline; four values map to block-start, inline-end,
 * block-end, and inline-start — see
 * [MDN: logical properties](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values).
 */
export function resolveBox(
	prefix: "padding" | "margin" | "scrollPadding" | "scrollMargin",
	values: SpacingValue[],
): CSSStyles {
	let result: Record<string, string> = {};
	if (values.length === 1) {
		let [all] = values as [SpacingValue];
		result[prefix] = spacing(all);
	} else if (values.length === 2) {
		let [block, inline] = values as [SpacingValue, SpacingValue];
		result[`${prefix}Block`] = spacing(block);
		result[`${prefix}Inline`] = spacing(inline);
	} else if (values.length === 4) {
		let [blockStart, inlineEnd, blockEnd, inlineStart] = values as [
			SpacingValue,
			SpacingValue,
			SpacingValue,
			SpacingValue,
		];
		result[`${prefix}BlockStart`] = spacing(blockStart);
		result[`${prefix}InlineEnd`] = spacing(inlineEnd);
		result[`${prefix}BlockEnd`] = spacing(blockEnd);
		result[`${prefix}InlineStart`] = spacing(inlineStart);
	} else {
		throw new Error(`@pkg/u: expected 1, 2, or 4 values, got ${values.length}`);
	}
	return result as CSSStyles;
}

/** Resolves a 1 or 2-value logical edge shorthand (`padding-inline`, `margin-block`, ...). */
export function resolveEdge(values: SpacingValue[]): string {
	return values.map(spacing).join(" ");
}
