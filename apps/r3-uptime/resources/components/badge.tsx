/**
 * Status pill used across dashboard tables, monitor detail pages, and public status
 * pages. Wraps the base badge style with one of the four semantic color mixins so
 * call sites only need to name a tone instead of composing the two mixins by hand.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { css } from "remix/ui";

import { status } from "~/resources/theme";

export type BadgeTone = "up" | "degraded" | "down" | "neutral";

namespace Badge {
	export interface Props {
		tone: BadgeTone;
		children: RemixNode;
	}
}

/**
 * Status badge base; combine with a status-specific color mixin. The OLD APP's
 * monitor-status pills (dashboard table, HTTP/DNS/TCP monitor lists) are an
 * outline style — transparent background, a colored border, and colored text —
 * not a filled chip; measured padding is `2px 10px`.
 */
const badge = css({
	display: "inline-flex",
	alignItems: "center",
	padding: "2px 10px",
	borderRadius: 999,
	border: "1px solid transparent",
	fontSize: "0.75rem",
	fontWeight: 600,
	textTransform: "capitalize",
});

/** Green "up"/valid/healthy badge color: transparent background, colored border + text. */
const badgeUp = css({
	background: "transparent",
	borderColor: status.up.light,
	color: status.up.light,
	"@media (prefers-color-scheme: dark)": {
		borderColor: status.up.dark,
		color: status.up.dark,
	},
});

/** Amber "degraded"/expiring/late badge color. */
const badgeDegraded = css({
	background: "transparent",
	borderColor: status.degraded.light,
	color: status.degraded.light,
	"@media (prefers-color-scheme: dark)": {
		borderColor: status.degraded.dark,
		color: status.degraded.dark,
	},
});

/** Red "down"/expired/error badge color. */
const badgeDown = css({
	background: "transparent",
	borderColor: status.down.light,
	color: status.down.light,
	"@media (prefers-color-scheme: dark)": {
		borderColor: status.down.dark,
		color: status.down.dark,
	},
});

/** Gray "pending"/unknown/disabled badge color. */
const badgeNeutral = css({
	background: "transparent",
	borderColor: status.neutral.light,
	color: status.neutral.light,
	"@media (prefers-color-scheme: dark)": {
		borderColor: status.neutral.dark,
		color: status.neutral.dark,
	},
});

const TONE_MIX: Record<BadgeTone, typeof badgeUp> = {
	up: badgeUp,
	degraded: badgeDegraded,
	down: badgeDown,
	neutral: badgeNeutral,
};

/** Renders `children` as a colored status pill for the given {@link BadgeTone}. */
export default function Badge(handle: Handle<Badge.Props>) {
	return () => <span mix={[badge, TONE_MIX[handle.props.tone]]}>{handle.props.children}</span>;
}
