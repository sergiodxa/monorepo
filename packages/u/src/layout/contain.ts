/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * The `contain` keywords, each a distinct promise about what the element's
 * subtree cannot do:
 *
 * - `layout` — the element's internals cannot affect the layout of anything
 *   outside it, and nothing outside it can affect their layout either.
 * - `paint` — descendants never paint outside the element's bounds; anything
 *   that would overflow is clipped away.
 * - `size` — the element's size does not depend on its contents. This is the
 *   surprising one: the box is then laid out as if it were empty, so it
 *   collapses to zero unless a size is given explicitly (or reserved through
 *   `contain-intrinsic-size`).
 * - `style` — scopes counters and quotes to the subtree, so a counter
 *   incremented inside cannot leak out and continue a counter outside.
 * - `content` — shorthand for `layout paint style`.
 * - `strict` — `content` plus `size`.
 * - `none` — opts out of containment entirely (the CSS default).
 *
 * The `(string & {})` member keeps the type a plain string so space-separated
 * combinations (`"layout paint"`) are accepted, since the keywords other than
 * `none`/`content`/`strict` compose freely.
 */
export type ContainValue =
	| "none"
	| "strict"
	| "content"
	| "size"
	| "inline-size"
	| "layout"
	| "style"
	| "paint"
	| (string & {});

/**
 * Applies `contain`, promising the browser something about what the host
 * element's subtree can and cannot affect so it can skip work it is then able
 * to prove unnecessary. That payoff shows up where the work is repeated or
 * expensive — a long list whose rows each re-layout on every change, or a
 * complex widget deep in the tree — because containment stops a change inside
 * from forcing the whole document to be re-laid out or repainted. Defaults to
 * `"content"`.
 *
 * `"content"` is the safe general-purpose value: it contains layout, paint,
 * and style without touching sizing, so the element still grows to fit its
 * contents. `"strict"` adds `size` containment on top, which means the element
 * no longer measures its contents at all and collapses to zero unless it is
 * given an explicit size — only reach for it when the size is already fixed.
 *
 * This is the bare primitive, and it sits next to two related utilities.
 * {@link contentVisibility} is the primitive for skipping *rendering* of the
 * contents rather than constraining what they can affect, and
 * {@link virtualize} pairs `content-visibility: auto` with a
 * `contain-intrinsic-size` placeholder — that placeholder is the same
 * reserved-size mechanism `size` containment relies on, which is why the
 * long-list case is usually better served by {@link virtualize} than by
 * `"strict"` here.
 *
 * Two side effects catch people out. Any value other than `"none"` makes the
 * element a containing block for its absolutely positioned descendants, so an
 * `u.absolute()` child that used to resolve against an ancestor now resolves
 * against this element instead. And `paint` or `layout` containment creates a
 * stacking context, so a `z-index` inside the subtree is no longer compared
 * against elements outside it.
 *
 * @example u.contain()
 * @example css({ contain: "content" })
 * @example u.contain("layout paint")
 * @example css({ contain: "layout paint" })
 * @example u.contain("strict")
 * @example css({ contain: "strict" })
 * @example u.contain("none")
 * @example css({ contain: "none" })
 */
export function contain<Node extends Element = Element>(value: ContainValue = "content") {
	return utility<Node>(() => ({ contain: value }));
}
