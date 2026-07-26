/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ColorValue } from "../types";

import { utility } from "../internal/descriptor";
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
 * @example u.ringShadow("primary")
 * @example css({ boxShadow: "0 0 0 2px var(--ui-primary-bg-solid)" })
 * @example u.ringShadow("danger", 3)
 * @example css({ boxShadow: "0 0 0 3px var(--ui-danger-bg-solid)" })
 */
export function ringShadow<Node extends Element = Element>(
	value: ColorValue | (string & {}),
	width: number | (string & {}) = 2,
) {
	return utility<Node>(() => {
		let resolvedWidth = typeof width === "number" ? `${width}px` : width;
		return { boxShadow: `0 0 0 ${resolvedWidth} ${color(value, "bg-solid")}` };
	});
}
