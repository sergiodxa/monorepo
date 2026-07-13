/**
 * A single labeled figure inside a dashboard/detail-page stat row. `value` accepts
 * any node (not just text) since some stat cards render badges instead of a plain
 * number, e.g. the dashboard's SSL certificate counts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { css } from "remix/ui";

import { neutral } from "~/resources/theme";

namespace StatCard {
	export interface Props {
		/**
		 * Usually plain text, but accepts any node so a card can italicize part of its
		 * label (e.g. the dashboard's "Slowest Endpoint" card naming the monitor).
		 */
		label: RemixNode;
		value: RemixNode;
	}
}

/** Renders a dashboard stat card with a muted label and a large value. */
export default function StatCard(handle: Handle<StatCard.Props>) {
	return () => (
		<div
			mix={[
				css({
					flex: "1 1 160px",
					padding: 16,
					borderRadius: 8,
					border: `1px solid ${neutral[200]}`,
					"@media (prefers-color-scheme: dark)": {
						borderColor: neutral[800],
					},
				}),
			]}
		>
			<div
				mix={[
					css({
						fontSize: "0.8125rem",
						marginBottom: 8,
						color: neutral[500],
						"@media (prefers-color-scheme: dark)": {
							color: neutral[400],
						},
					}),
				]}
			>
				{handle.props.label}
			</div>
			<div
				mix={[
					css({
						fontSize: "1.5rem",
						fontWeight: 700,
						lineHeight: "2rem",
					}),
				]}
			>
				{handle.props.value}
			</div>
		</div>
	);
}
