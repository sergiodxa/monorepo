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

namespace StatCard {
	export interface Props {
		label: string;
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
					border: "1px solid oklch(0.91 0.008 145)",
					"@media (prefers-color-scheme: dark)": {
						borderColor: "oklch(0.32 0.006 145)",
					},
				}),
			]}
		>
			<div
				mix={[
					css({
						fontSize: "0.8125rem",
						marginBottom: 8,
						color: "oklch(0.62 0.01 145)",
						"@media (prefers-color-scheme: dark)": {
							color: "oklch(0.73 0.01 145)",
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
