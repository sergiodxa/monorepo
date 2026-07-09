/**
 * Placeholder box shown in place of a list/table when there is no data yet, with an
 * optional primary call-to-action link. Exists so every "no X yet" list view shares
 * one composition of the empty-state box instead of repeating the message/action
 * markup per view.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { css } from "remix/ui";

namespace EmptyState {
	export interface Action {
		href: string;
		label: string;
	}

	export interface Props {
		message: RemixNode;
		action?: Action;
	}
}

/**
 * Empty-state placeholder box, matching the OLD APP's "No DNS monitors yet"
 * panel: centered (not left-aligned) content, a bigger radius, and generous
 * padding (measured `64px 32px`).
 */
const emptyState = css({
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	textAlign: "center",
	gap: 12,
	padding: "64px 32px",
	border: "1px dashed oklch(0.83 0.01 145)",
	borderRadius: 12,
	"@media (prefers-color-scheme: dark)": {
		borderColor: "oklch(0.42 0.008 145)",
	},
});

/**
 * Primary action button/link for the signed-in app shell (dashboard, forms,
 * settings). The OLD APP reserves brand green for marketing CTAs — every
 * in-app primary action (Create Monitor, Save Changes, Invite Member, ...)
 * instead uses a near-black button.
 */
const buttonPrimary = css({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	padding: "8px 16px",
	borderRadius: 6,
	border: "1px solid transparent",
	background: "oklch(0.24 0.005 145)",
	color: "#ffffff",
	fontFamily: "inherit",
	fontSize: "0.875rem",
	fontWeight: 500,
	cursor: "pointer",
	textDecoration: "none",
	"&:hover": { background: "oklch(0.32 0.006 145)" },
});

/** Renders {@link EmptyState.Props.message} with an optional {@link EmptyState.Props.action} link. */
export default function EmptyState(handle: Handle<EmptyState.Props>) {
	return () => (
		<div mix={[emptyState]}>
			<p>{handle.props.message}</p>
			{handle.props.action && (
				<a href={handle.props.action.href} mix={[buttonPrimary]}>
					{handle.props.action.label}
				</a>
			)}
		</div>
	);
}
