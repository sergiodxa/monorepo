/**
 * Maps this app's four monitor-status tones onto `@sdxc/ui`'s `Badge` props
 * (`up`→`success`, `degraded`→`warning`, `down`→`danger`, `neutral`→`neutral`,
 * always paired with the `"outline"` variant — a transparent chip with just a
 * colored border and text), so call sites name a tone and get the matching
 * color/variant pair automatically. Spread the result onto `@sdxc/ui`'s real
 * `Badge` directly: `<Badge {...badgeVariant(tone)}>{children}</Badge>`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type BadgeTone = "up" | "degraded" | "down" | "neutral";

const TONE_COLOR: Record<BadgeTone, "success" | "warning" | "danger" | "neutral"> = {
	up: "success",
	degraded: "warning",
	down: "danger",
	neutral: "neutral",
};

/** Returns the `@sdxc/ui` `Badge` props for the given {@link BadgeTone}. */
export function badgeVariant(tone: BadgeTone): {
	color: "success" | "warning" | "danger" | "neutral";
	variant: "outline";
} {
	return { color: TONE_COLOR[tone], variant: "outline" };
}
