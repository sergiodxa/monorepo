/**
 * Status pill used across dashboard tables, monitor detail pages, and public status
 * pages. Wraps {@link s.badge} with one of the four semantic color mixins so call
 * sites only need to name a tone instead of composing the two mixins by hand.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import * as s from "~/resources/styles";

export type BadgeTone = "up" | "degraded" | "down" | "neutral";

namespace Badge {
	export interface Props {
		tone: BadgeTone;
		children: RemixNode;
	}
}

const TONE_MIX: Record<BadgeTone, typeof s.badgeUp> = {
	up: s.badgeUp,
	degraded: s.badgeDegraded,
	down: s.badgeDown,
	neutral: s.badgeNeutral,
};

/** Renders `children` as a colored status pill for the given {@link BadgeTone}. */
export default function Badge(handle: Handle<Badge.Props>) {
	return () => <span mix={[s.badge, TONE_MIX[handle.props.tone]]}>{handle.props.children}</span>;
}
