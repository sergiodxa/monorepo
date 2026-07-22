/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { var as varUtility } from "../general/var";
import { utility } from "../internal/descriptor";

export type LeadingValue = number | "none" | "tight" | "snug" | "normal" | "relaxed" | "loose";

const LEADING_FALLBACKS: Record<Exclude<LeadingValue, number>, number> = {
	none: 1,
	tight: 1.25,
	snug: 1.375,
	normal: 1.5,
	relaxed: 1.625,
	loose: 2,
};

/**
 * Applies `line-height`. Named values resolve through
 * `var(--ui-leading-{name}, fallback)` so an app can override the scale
 * without losing the sensible default; a raw number passes through
 * unchanged as a unitless line-height multiplier.
 *
 * @example u.leading("relaxed")
 * @example css({ lineHeight: "var(--ui-leading-relaxed, 1.625)" })
 * @example u.leading(1.8)
 * @example css({ lineHeight: 1.8 })
 */
export function leading<Node extends Element = Element>(value: LeadingValue = "normal") {
	return utility<Node>(() => ({
		lineHeight:
			typeof value === "number"
				? value
				: varUtility(`ui-leading-${value}`, `${LEADING_FALLBACKS[value]}`),
	}));
}
