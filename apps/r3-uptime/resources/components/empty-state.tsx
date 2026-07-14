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

import LinkButton from "~/resources/components/link-button";

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
 * Empty-state placeholder box: centered (not left-aligned) content, a large
 * border radius, and generous padding (`64px 32px`).
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

/** Renders {@link EmptyState.Props.message} with an optional {@link EmptyState.Props.action} link. */
export default function EmptyState(handle: Handle<EmptyState.Props>) {
	return () => (
		<div mix={[emptyState]}>
			<p>{handle.props.message}</p>
			{handle.props.action && (
				<LinkButton href={handle.props.action.href}>{handle.props.action.label}</LinkButton>
			)}
		</div>
	);
}
