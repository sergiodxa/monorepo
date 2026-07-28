/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * The `white-space` keywords, which each answer two separate questions at
 * once — whether runs of whitespace and newlines in the source are preserved,
 * and whether lines are allowed to wrap:
 *
 * - `normal` collapses whitespace and wraps.
 * - `nowrap` collapses whitespace but never wraps.
 * - `pre` preserves whitespace and newlines and never wraps.
 * - `pre-wrap` preserves whitespace and newlines and still wraps.
 * - `pre-line` collapses runs of spaces but honours newlines.
 * - `break-spaces` is `pre-wrap` plus a wrapping opportunity after every
 *   preserved space, so a long run of trailing spaces can break instead of
 *   overflowing.
 */
export type WhiteSpaceValue =
	| "normal"
	| "nowrap"
	| "pre"
	| "pre-wrap"
	| "pre-line"
	| "break-spaces";

/**
 * Applies `white-space`, the general primitive behind three narrower
 * utilities that already set this property: `u.nowrap()` (`nowrap`),
 * `u.truncate()` (which composes `u.nowrap()`), and `u.visuallyHidden()`
 * (`nowrap`, to keep its clip rect stable regardless of surrounding text
 * wrapping). Because all four write the same declaration, this utility
 * conflicts with each of them on the same element — pick one.
 *
 * The default is `"pre-wrap"` because it is the one case with no other path
 * today: preformatted text or a code block that must keep its own
 * indentation and line breaks *and* still wrap inside a narrow container,
 * rather than overflowing it. Reach for the dedicated utilities for the cases
 * they name.
 *
 * `white-space` is inherited, so setting it on a container applies to the
 * text of its descendants until one of them sets it again.
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
