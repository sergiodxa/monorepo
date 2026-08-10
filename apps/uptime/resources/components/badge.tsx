/**
 * Maps this app's four monitor-status tones onto `@pkg/ui`'s `Badge` props
 * (`up`→`success`, `degraded`→`warning`, `down`→`danger`, `neutral`→`neutral`,
 * always paired with the `"outline"` variant — a transparent chip with just a
 * colored border and text) so call sites only need to name a tone instead of
 * picking a color/variant pair themselves. Spread the result onto `@pkg/ui`'s
 * real `Badge` directly: `<Badge {...badgeVariant(tone)}>{children}</Badge>`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type BadgeTone = "up" | "degraded" | "down" | "neutral";

/** Maps this app's monitor-status tone onto `@pkg/ui`'s `Badge` semantic color. */
const TONE_COLOR: Record<BadgeTone, "success" | "warning" | "danger" | "neutral"> = {
	up: "success",
	degraded: "warning",
	down: "danger",
	neutral: "neutral",
};

/** Returns the `@pkg/ui` `Badge` props for the given {@link BadgeTone}. */
export function badgeVariant(tone: BadgeTone): {
	color: "success" | "warning" | "danger" | "neutral";
	variant: "outline";
} {
	return { color: TONE_COLOR[tone], variant: "outline" };
}
