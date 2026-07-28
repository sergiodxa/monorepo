/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/** The accepted `transform-style` values. */
export type TransformStyleValue = "flat" | "preserve-3d";

/**
 * Keeps an element's children positioned in their own 3D space instead of
 * flattening them into the parent's plane. It belongs on the **parent** of
 * the 3D-transformed children, not on the rotating child itself.
 *
 * CSS defaults to `flat`, which collapses the whole subtree onto one plane —
 * that's why a `u.rotateY()` flip looks like a horizontal squash rather than
 * a card turning over until `preserve-3d` is set on its container. Pair it
 * with `u.perspective()` for a vanishing point and `u.backfaceVisibility()`
 * so the reversed face doesn't show through.
 *
 * `transform-style` is its own CSS property rather than a transform
 * function, so it's set outright and never joins the additive `transform`
 * composition the `transform/` function utilities share.
 *
 * Caveat worth knowing, because it breaks the effect silently: `preserve-3d`
 * can't be combined with clipping or filtering on the same element. An
 * `overflow` other than `visible`, a `filter`, a `mask`, or an `opacity`
 * below 1 each force the subtree back to `flat`. Move those to a wrapper
 * element instead of putting them next to this utility.
 *
 * @example u.transformStyle()
 * @example css({ transformStyle: "preserve-3d" })
 * @example u.transformStyle("flat")
 * @example css({ transformStyle: "flat" })
 */
export function transformStyle<Node extends Element = Element>(
	value: TransformStyleValue = "preserve-3d",
) {
	return utility<Node>(() => ({ transformStyle: value }));
}
