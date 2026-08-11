/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { when } from "./when";

/**
 * Sugar over `when(":is({selector}) ~ &", input)`. The mirror of `hasSibling()`:
 * both style an element from a sibling's state, and which one you need is
 * decided purely by source order. `hasSibling()` looks *forward* — the styled
 * element comes first — while this looks *backward*, so the element matching
 * `selector` comes first and the styled element after it.
 *
 * That backward direction is usually the one a compound control wants, because
 * it is the accessible source order: the real `<input>` comes first, and the
 * element painting the visible indicator follows it. It also has no `:has()`
 * dependency — a plain `~` combinator has been supported far longer — and it
 * keeps specificity flat, where `:has()` takes the specificity of its most
 * specific argument.
 *
 * Unlike the marker-class conventions some utility frameworks use for this, no
 * class or attribute has to be added to the sibling: it is named by its own
 * selector, so there is nothing to keep in sync and nothing for this package to
 * register at runtime.
 *
 * `~` matches any preceding sibling, not only the immediately preceding one.
 * For the adjacent-only form, reach for `when(":is({selector}) + &", input)`.
 *
 * The `:is()` wrapper is load-bearing, not cosmetic: the style serializer only
 * recognizes a key as a nested selector when it starts with `&`, `@`, `:`, `[`
 * or `.`, so a bare `input:checked ~ &` would be emitted as a declaration
 * instead of a rule and the styles would never reach the browser. `:is()` adds
 * no specificity of its own beyond its argument, so the selector matches
 * exactly what the caller asked for.
 *
 * @example u.precededBy("input:checked", u.border("brand.solid"))
 * @example css({ ":is(input:checked) ~ &": { borderColor: "var(--ui-brand-bg-solid)" } })
 * @example u.precededBy("input:focus-visible", u.outline({ color: "brand", offset: 2 }))
 * @example css({ ":is(input:focus-visible) ~ &": { outlineColor: "...", outlineOffset: "2px" } })
 */
export function precededBy<Node extends Element = Element>(
	selector: string,
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return when<Node>(`:is(${selector}) ~ &`, input);
}
