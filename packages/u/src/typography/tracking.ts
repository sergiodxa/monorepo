/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { var as varUtility } from "../general/var";
import { utility } from "../internal/descriptor";

type NamedTrackingValue = "tighter" | "tight" | "normal" | "wide" | "wider" | "widest";

export type TrackingValue = NamedTrackingValue | (string & {});

const TRACKING_FALLBACKS: Record<NamedTrackingValue, string> = {
	tighter: "-0.05em",
	tight: "-0.025em",
	normal: "0em",
	wide: "0.025em",
	wider: "0.05em",
	widest: "0.1em",
};

/**
 * Applies `letter-spacing` from the named tracking scale, resolving through
 * `var(--ui-tracking-{name}, fallback)` so the scale works before an app
 * ever defines the variable. Any other string (a raw `letter-spacing` value
 * like `"0.18em"` or `"-0.04em"`) passes through unchanged instead of being
 * mistaken for a named scale step.
 *
 * @example u.tracking("wide")
 * @example css({ letterSpacing: "var(--ui-tracking-wide, 0.025em)" })
 * @example u.tracking("0.18em")
 * @example css({ letterSpacing: "0.18em" })
 */
export function tracking<Node extends Element = Element>(value: TrackingValue = "normal") {
	return utility<Node>(() => ({
		letterSpacing:
			value in TRACKING_FALLBACKS
				? varUtility(`ui-tracking-${value}`, TRACKING_FALLBACKS[value as NamedTrackingValue])
				: value,
	}));
}
