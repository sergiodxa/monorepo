/**
 * `box-shadow` takes a comma-separated list, so each shadow utility writes its
 * own slot custom property plus one identical two-slot declaration referencing
 * both slots with a transparent `0 0 #0000` fallback, letting `u.shadow("lg")`
 * and `u.ringShadow("brand")` render as two layers on one element. Slot order
 * is fixed: the ring hugs the edge and the elevation shadow falls outside it.
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
 * Builds a composable box-shadow-slot utility: sets the given
 * `--ui-box-shadow-{slot}` custom property plus the shared composite
 * `boxShadow` declaration, so ring and elevation render as two stacked layers.
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
