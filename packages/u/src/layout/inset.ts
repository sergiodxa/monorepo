/**
 * Logical `inset` shorthand resolution, mirroring the 1/2/4-value box
 * shorthand `u.p()`/`u.m()` use for padding and margin. `inset` has no
 * dedicated logical-box helper of its own in `internal/box.ts` (that one is
 * typed specifically for `"padding" | "margin"`), so this module resolves
 * the same value counts against `inset`/`insetBlock`/`insetInline`'s own
 * property names directly.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSStyles } from "../internal/css-styles";
import type { SpacingValue } from "../internal/tokens";

import { utility } from "../internal/descriptor";
import { spacing } from "../internal/tokens";

function resolveInset(values: SpacingValue[]): CSSStyles {
	let result: Record<string, string> = {};
	if (values.length === 1) {
		let [all] = values as [SpacingValue];
		result.inset = spacing(all);
	} else if (values.length === 2) {
		let [block, inline] = values as [SpacingValue, SpacingValue];
		result.insetBlock = spacing(block);
		result.insetInline = spacing(inline);
	} else if (values.length === 4) {
		let [blockStart, inlineEnd, blockEnd, inlineStart] = values as [
			SpacingValue,
			SpacingValue,
			SpacingValue,
			SpacingValue,
		];
		result.insetBlockStart = spacing(blockStart);
		result.insetInlineEnd = spacing(inlineEnd);
		result.insetBlockEnd = spacing(blockEnd);
		result.insetInlineStart = spacing(inlineStart);
	} else {
		throw new Error(`@pkg/u: expected 1, 2, or 4 values, got ${values.length}`);
	}
	return result as CSSStyles;
}

/**
 * Applies a logical `inset` shorthand using the spacing scale or a raw CSS
 * length. One value applies all four sides; two values map to block then
 * inline; four values map to block-start, inline-end, block-end, and
 * inline-start — see
 * [MDN: logical properties](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values).
 *
 * @example u.inset(4)
 * @example css({ inset: "calc(var(--ui-spacing, 0.25rem) * 4)" })
 * @example u.inset(0, "auto")
 * @example css({ insetBlock: "0", insetInline: "auto" })
 * @example u.inset(1, 2, 3, 4)
 * @example css({ insetBlockStart: "...", insetInlineEnd: "...", insetBlockEnd: "...", insetInlineStart: "..." })
 */
export function inset<Node extends Element = Element>(...values: SpacingValue[]) {
	return utility<Node>(() => resolveInset(values));
}
