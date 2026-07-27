/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { var as varUtility } from "../general/var";
import { utility } from "../internal/descriptor";

type NamedLeadingValue = "none" | "tight" | "snug" | "normal" | "relaxed" | "loose";

export type LeadingValue = number | NamedLeadingValue | (string & {});

const LEADING_FALLBACKS: Record<NamedLeadingValue, number> = {
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
 * unchanged as a unitless line-height multiplier; any other string (a raw
 * CSS length like `"16px"` or `"2rem"`) passes through unchanged as a
 * literal `line-height` value instead of being mistaken for a named scale
 * step.
 *
 * @example u.leading("relaxed")
 * @example css({ lineHeight: "var(--ui-leading-relaxed, 1.625)" })
 * @example u.leading(1.8)
 * @example css({ lineHeight: 1.8 })
 * @example u.leading("2rem")
 * @example css({ lineHeight: "2rem" })
 */
export function leading<Node extends Element = Element>(value: LeadingValue = "normal") {
	return utility<Node>(() => ({
		lineHeight:
			typeof value === "number"
				? value
				: value in LEADING_FALLBACKS
					? varUtility(`ui-leading-${value}`, `${LEADING_FALLBACKS[value as NamedLeadingValue]}`)
					: value,
	}));
}
