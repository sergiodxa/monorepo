/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

/**
 * Each keyword requests an OpenType feature for shaping digits or
 * fractions; the raw string escape accepts a space-separated combination,
 * matching what `font-variant-numeric` itself accepts.
 *
 * @see {@link fontVariantNumeric}
 */
export type FontVariantNumericValue =
	| "normal"
	| "ordinal"
	| "slashed-zero"
	| "lining-nums"
	| "oldstyle-nums"
	| "proportional-nums"
	| "tabular-nums"
	| "diagonal-fractions"
	| "stacked-fractions"
	| (string & {});

/**
 * Sets `font-variant-numeric`; `u.tabularNums()` covers the common
 * tabular-nums case and shares the same declaration. Each keyword names an
 * OpenType feature — a font that lacks it renders unchanged digits.
 *
 * @example u.fontVariantNumeric()
 * @example css({ fontVariantNumeric: "tabular-nums" })
 * @example u.fontVariantNumeric("slashed-zero")
 * @example css({ fontVariantNumeric: "slashed-zero" })
 * @example u.fontVariantNumeric("tabular-nums slashed-zero")
 * @example css({ fontVariantNumeric: "tabular-nums slashed-zero" })
 */
export function fontVariantNumeric<Node extends Element = Element>(
	value: FontVariantNumericValue = "tabular-nums",
) {
	return utility<Node>(() => ({ fontVariantNumeric: value }));
}
