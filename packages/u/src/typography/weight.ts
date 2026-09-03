/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

export type FontWeightValue =
	| number
	| "thin"
	| "extralight"
	| "light"
	| "normal"
	| "medium"
	| "semibold"
	| "bold"
	| "extrabold"
	| "black";

const FONT_WEIGHT_ALIASES: Record<Exclude<FontWeightValue, number>, number> = {
	thin: 100,
	extralight: 200,
	light: 300,
	normal: 400,
	medium: 500,
	semibold: 600,
	bold: 700,
	extrabold: 800,
	black: 900,
};

/**
 * Applies `font-weight`. Named values alias the standard numeric weight
 * scale (`thin` 100 through `black` 900); a raw number passes through
 * unchanged for values the named scale doesn't cover.
 *
 * @example u.weight("semibold")
 * @example css({ fontWeight: 600 })
 * @example u.weight(550)
 * @example css({ fontWeight: 550 })
 */
export function weight<Node extends Element = Element>(value: FontWeightValue = "normal") {
	return utility<Node>(() => ({
		fontWeight: typeof value === "number" ? value : FONT_WEIGHT_ALIASES[value],
	}));
}
