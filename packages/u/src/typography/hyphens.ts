/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * The `hyphens` keywords:
 *
 * - `none` never hyphenates, not even at an explicit soft hyphen.
 * - `manual` is CSS's own default, breaking only where the markup already
 *   marks an opportunity with `&shy;` or `<wbr>`.
 * - `auto` lets the browser hyphenate on its own, using its hyphenation
 *   dictionary for the element's language.
 */
export type HyphensValue = "none" | "manual" | "auto";

/**
 * Applies `hyphens`, letting long words break with a hyphen at the end of a
 * line instead of forcing the line to stay short.
 *
 * `"auto"` only works when the element's language is known: the browser picks
 * a hyphenation dictionary from a `lang` attribute on the element or on one of
 * its ancestors, and with no `lang` anywhere it has no dictionary to consult
 * and hyphenates nothing. That missing attribute is by far the most common
 * reason this utility looks broken.
 *
 * It pairs naturally with `u.textAlign("justify")`. Justifying text without
 * hyphenation stretches the word spacing of each line to fill the measure,
 * which opens uneven rivers of whitespace down the column; hyphenation is the
 * standard fix, giving the justification more break points to work with.
 *
 * For a string with no dictionary entry at all — a URL, a hash, an
 * identifier — hyphenation can't help, and `u.overflowWrap()` is the tool that
 * breaks it.
 *
 * @example u.hyphens()
 * @example css({ hyphens: "auto" })
 * @example u.hyphens("manual")
 * @example css({ hyphens: "manual" })
 * @example u.hyphens("none")
 * @example css({ hyphens: "none" })
 */
export function hyphens<Node extends Element = Element>(value: HyphensValue = "auto") {
	return utility<Node>(() => ({ hyphens: value }));
}
