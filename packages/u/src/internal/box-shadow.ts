/**
 * `box-shadow` is a single CSS property whose value is a comma-separated
 * *list*, so two utilities that each set it outright can't stack the way the
 * list syntax suggests — the later declaration replaces the earlier one
 * wholesale. That's the same problem `internal/transform.ts` solves for
 * `transform`, and it's solved the same way here: each shadow utility writes
 * its own slot custom property and the exact same fixed, two-slot `box-shadow`
 * declaration referencing both slots with a transparent identity fallback
 * (`0 0 #0000`, a shadow that paints nothing). Since the composite value text
 * is identical across every shadow utility, it doesn't matter whose copy wins
 * the cascade — the resolved `box-shadow` always reads every slot any applied
 * utility set. So `u.shadow("lg")` and `u.ringShadow("brand")` on one element
 * now render both layers instead of one erasing the other.
 *
 * Slot order is fixed and meaningful: the ring paints before the elevation, so
 * a selection ring hugs the element's edge and the elevation shadow falls
 * outside it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { var as varUtility } from "../general/var";

import type { CSSStyles } from "./css-styles";
import type { UtilityMixin } from "./descriptor";

import { utility } from "./descriptor";

/** The CSS custom property (without its leading `--`) each box-shadow slot reads from. */
const BOX_SHADOW_VARS = {
	ring: "ui-box-shadow-ring",
	elevation: "ui-box-shadow-elevation",
} as const;

export type BoxShadowSlotName = keyof typeof BOX_SHADOW_VARS;

/** The fixed, identical-everywhere `boxShadow` value every shadow utility emits. */
export const COMPOSITE_BOX_SHADOW = [
	varUtility(BOX_SHADOW_VARS.ring, "0 0 #0000"),
	varUtility(BOX_SHADOW_VARS.elevation, "0 0 #0000"),
].join(", ");

/**
 * Builds a composable box-shadow-slot utility: sets the specific
 * `--ui-box-shadow-{slot}` custom property given, plus the shared composite
 * `boxShadow` declaration, so a ring and an elevation shadow applied to the
 * same element render as two layers rather than overwriting each other.
 */
export function boxShadowSlot<Node extends Element = Element>(
	values: Partial<Record<BoxShadowSlotName, string>>,
): UtilityMixin<Node> {
	return utility<Node>(() => {
		let result: Record<string, string> = {};
		for (let name of Object.keys(values) as BoxShadowSlotName[]) {
			result[`--${BOX_SHADOW_VARS[name]}`] = values[name] as string;
		}
		result.boxShadow = COMPOSITE_BOX_SHADOW;
		return result as CSSStyles;
	});
}
