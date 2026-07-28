/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * The `font-variant-numeric` keywords, each selecting a different OpenType
 * feature for how digits and fractions are shaped:
 *
 * - `normal` disables every one of these features.
 * - `ordinal` shapes ordinal markers (`1st`, `2ª`) as proper superscript
 *   glyphs.
 * - `slashed-zero` draws zero with a slash through it.
 * - `lining-nums` uses digits that all sit on the baseline at cap height.
 * - `oldstyle-nums` uses text figures, with ascenders and descenders like
 *   lowercase letters.
 * - `proportional-nums` gives each digit its own natural width.
 * - `tabular-nums` gives every digit the same width, so columns line up.
 * - `diagonal-fractions` shapes `1/2` as a slanted fraction.
 * - `stacked-fractions` shapes `1/2` as a stacked, horizontal-bar fraction.
 *
 * The raw string escape accepts a space-separated combination of the above,
 * which is what the property itself accepts — see {@link fontVariantNumeric}.
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
 * Applies `font-variant-numeric`. `u.tabularNums()` already sets this
 * property to `tabular-nums` and stays the right call for that common case;
 * this is the primitive for every other value, and the two conflict on the
 * same element since both write the same declaration.
 *
 * Every one of these values is a request for an OpenType feature the font
 * must actually ship: a font with no `onum` table simply ignores
 * `"oldstyle-nums"` and renders its ordinary digits, with no error and no
 * fallback. Check the typeface before relying on one.
 *
 * The values that genuinely earn their place: `"slashed-zero"` to tell 0 apart
 * from O in an identifier, key, or code sample; `"diagonal-fractions"` for a
 * recipe quantity or a measurement; `"oldstyle-nums"` for numerals set inside
 * running prose, where lining figures read as too loud.
 *
 * Because the property takes a space-separated combination, the raw string
 * escape is how you ask for more than one feature at once.
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
