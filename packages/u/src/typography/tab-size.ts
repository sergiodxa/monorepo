/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Applies `tab-size`, the width a literal tab character renders at. A bare
 * number is a count of space characters and is stringified so it stays
 * unitless, which is what the property expects — a number would otherwise be
 * serialized as a `px` length, sizing the tab in pixels instead of
 * characters. A string passes through unchanged, so a CSS length (`"4ch"`,
 * `"2rem"`) works too.
 *
 * Prefer the unitless count over a length: the count resolves against the
 * font of whatever element the inherited value lands on, while a length is
 * resolved once where it is declared, so a `ch` value declared on a container
 * would keep that container's font rather than the code block's.
 *
 * This only has any effect where tab characters actually survive into the
 * rendered text, i.e. alongside `u.whiteSpace("pre")` or
 * `u.whiteSpace("pre-wrap")`. Under collapsed whitespace every tab has
 * already become a single space, so there is nothing left to size.
 *
 * The real use is a code block: the browser's default of 8 is far wider than
 * any modern source file is indented, and 2 or 4 matches what the code was
 * written against.
 *
 * @example u.tabSize()
 * @example css({ tabSize: "2" })
 * @example u.tabSize(4)
 * @example css({ tabSize: "4" })
 * @example u.tabSize("4ch")
 * @example css({ tabSize: "4ch" })
 */
export function tabSize<Node extends Element = Element>(value: number | (string & {}) = 2) {
	return utility<Node>(() => ({ tabSize: String(value) }));
}
