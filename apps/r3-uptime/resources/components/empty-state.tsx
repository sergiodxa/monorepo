/**
 * Placeholder box shown in place of a list/table when there is no data yet, with an
 * optional primary call-to-action link. Exists so every "no X yet" list view shares
 * one composition of {@link s.emptyState} instead of repeating the message/action
 * markup per view.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import * as s from "~/resources/styles";

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

/** Renders {@link EmptyState.Props.message} with an optional {@link EmptyState.Props.action} link. */
export default function EmptyState(handle: Handle<EmptyState.Props>) {
	return () => (
		<div mix={[s.emptyState]}>
			<p>{handle.props.message}</p>
			{handle.props.action && (
				<a href={handle.props.action.href} mix={[s.buttonPrimary]}>
					{handle.props.action.label}
				</a>
			)}
		</div>
	);
}
