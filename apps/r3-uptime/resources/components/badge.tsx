/**
 * Status pill used across dashboard tables, monitor detail pages, and public status
 * pages. Maps this app's four monitor-status tones onto `@pkg/r3-ui`'s `Badge`
 * semantic colors (`up`→`success`, `degraded`→`warning`, `down`→`danger`,
 * `neutral`→`neutral`) and its `"outline"` variant — a transparent chip with just
 * a colored border and text, matching this badge's original look — so call sites
 * only need to name a tone instead of picking a color/variant pair themselves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { Badge as UIBadge } from "@pkg/r3-ui";

export type BadgeTone = "up" | "degraded" | "down" | "neutral";

namespace Badge {
	export interface Props {
		tone: BadgeTone;
		children: RemixNode;
	}
}

/** Maps this app's monitor-status tone onto `@pkg/r3-ui`'s `Badge` semantic color. */
const TONE_COLOR: Record<BadgeTone, "success" | "warning" | "danger" | "neutral"> = {
	up: "success",
	degraded: "warning",
	down: "danger",
	neutral: "neutral",
};

/** Renders `children` as a colored, outlined status pill for the given {@link BadgeTone}. */
export default function Badge(handle: Handle<Badge.Props>) {
	return () => (
		<UIBadge color={TONE_COLOR[handle.props.tone]} variant="outline">
			{handle.props.children}
		</UIBadge>
	);
}
