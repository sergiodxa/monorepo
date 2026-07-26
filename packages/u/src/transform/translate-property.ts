/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Sets the standalone `translate` CSS property directly — distinct from
 * `u.translateX()`/`u.translateY()`, which set the `translate(...)`
 * *transform function* through the additive `transform`-composition
 * mechanism (see `internal/transform.ts`). `translate` is its own
 * independent CSS property, so a single utility call is enough: it isn't
 * part of that composition system and always overwrites outright, which
 * matches how it's actually used (at most one `translate` value active on a
 * given element at a time). Accepts the raw CSS shorthand value (one or two
 * offsets, or a keyword such as `none`) rather than the spacing scale, since
 * call sites need percentages and multi-axis shorthands `u.translateX()`
 * doesn't support.
 *
 * @example u.translateProperty("-50% 0")
 * @example css({ translate: "-50% 0" })
 */
export function translateProperty<Node extends Element = Element>(value: string) {
	return utility<Node>(() => ({ translate: value }));
}
