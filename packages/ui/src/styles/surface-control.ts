/**
 * The raised fill a `surface` button or link draws: the surface token, the emphasis ink
 * and the tactile control edge. Inside an inverse or brand band those tokens are
 * re-pointed at the fill's foreground, so the same control turns translucent there.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { UtilityMixin } from "@sdxc/u";

import { combine, raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";

/**
 * Paints a control as a raised surface with a transparent border, so it keeps the
 * footprint of its solid and outline siblings, and darkens the fill a step on hover.
 *
 * @returns A `css()` mixin ready for a control's `mix` prop.
 * @example
 * <button mix={[when('&[data-variant="surface"]', surfaceControl())]}>{label}</button>;
 */
export function surfaceControl<Node extends Element = Element>(): UtilityMixin<Node> {
	return combine<Node>([
		raw<Node>({
			backgroundColor: "var(--ui-surface-raised, Canvas)",
			borderColor: "transparent",
			color: "var(--ui-neutral-fg-emphasis)",
			boxShadow: "var(--ui-shadow-control, 0 0 0 1px rgb(0 0 0 / 0.08))",
		}),
		when<Node>(
			"&:hover",
			raw<Node>({
				backgroundColor:
					"color-mix(in oklch, var(--ui-surface-raised, Canvas), var(--ui-neutral-fg-emphasis) 6%)",
			}),
		),
	]);
}
