/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Each keyword controls two independent things: whether whitespace and
 * newlines are preserved, and whether lines can wrap. `break-spaces` extends
 * `pre-wrap` with a wrap opportunity after each preserved trailing space.
 */
export type WhiteSpaceValue =
	| "normal"
	| "nowrap"
	| "pre"
	| "pre-wrap"
	| "pre-line"
	| "break-spaces";

/**
 * Applies `white-space`; also written by `u.nowrap()`, `u.truncate()`, and
 * `u.visuallyHidden()`, so pick one. Defaults to `pre-wrap`, keeping
 * preformatted line breaks while still wrapping in a narrow container.
 *
 * @example u.whiteSpace()
 * @example css({ whiteSpace: "pre-wrap" })
 * @example u.whiteSpace("pre")
 * @example css({ whiteSpace: "pre" })
 * @example u.whiteSpace("pre-line")
 * @example css({ whiteSpace: "pre-line" })
 */
export function whiteSpace<Node extends Element = Element>(value: WhiteSpaceValue = "pre-wrap") {
	return utility<Node>(() => ({ whiteSpace: value }));
}
