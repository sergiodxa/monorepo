/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ColorValue } from "../types";

import { boxShadowSlot } from "../internal/box-shadow";
import { color } from "../internal/tokens";

/**
 * Draws a persistent selection ring via `box-shadow: 0 0 0 {width} {color}`,
 * rather than `outline`. Named distinctly from `@pkg/u/color`'s `ring()` —
 * that utility composes `u.focusVisible()` and only ever shows on
 * keyboard/assistive-tech focus, disappearing once focus moves on. This one
 * has no such gate: it stays visible for as long as a component applies it,
 * which is what a persistently-selected swatch, chip, or thumbnail needs
 * (`input:checked ~ &` and similar selectors keep it applied without a
 * focus state in the mix).
 *
 * The ring is written to the `ring` slot of the shared composite `boxShadow`
 * declaration, which paints before the `elevation` slot `u.shadow()` writes —
 * so a ring hugs the element's edge and an elevation shadow applied alongside
 * it falls outside the ring, instead of the two overwriting each other.
 *
 * @example u.ringShadow("brand")
 * @example css({ "--ui-box-shadow-ring": "0 0 0 2px var(--ui-brand-bg-solid)", boxShadow: "var(--ui-box-shadow-ring, 0 0 #0000), var(--ui-box-shadow-elevation, 0 0 #0000)" })
 * @example u.ringShadow("danger", 3)
 * @example css({ "--ui-box-shadow-ring": "0 0 0 3px var(--ui-danger-bg-solid)", boxShadow: "var(--ui-box-shadow-ring, 0 0 #0000), var(--ui-box-shadow-elevation, 0 0 #0000)" })
 */
export function ringShadow<Node extends Element = Element>(
	value: ColorValue | (string & {}),
	width: number | (string & {}) = 2,
) {
	let resolvedWidth = typeof width === "number" ? `${width}px` : width;
	return boxShadowSlot<Node>({ ring: `0 0 0 ${resolvedWidth} ${color(value, "bg-solid")}` });
}
