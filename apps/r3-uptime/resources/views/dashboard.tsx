/**
 * Team dashboard view. Shows stat cards (monitor count, 24h uptime, slowest response)
 * above a named `Frame` that loads the tab bar and its monitor-type table together,
 * so a tab switch keeps the tab bar's active state in sync with the table it swapped
 * in without reloading the stat cards.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css, Frame } from "remix/ui";

import type { DashboardTab } from "~/resources/views/dashboard-panel";

import Badge from "~/resources/components/badge";
import EmptyState from "~/resources/components/empty-state";
import StatCard from "~/resources/components/stat-card";
import routes from "~/routes/web";

export type { DashboardTab } from "~/resources/views/dashboard-panel";

namespace DashboardView {
	export interface Props {
		team: { slug: string; name: string };
		tab: DashboardTab;
		monitorCount: number;
		uptimePercent: number | null;
		slowestResponseMs: number | null;
		sslCounts: { valid: number; expiring: number; expired: number };
		analyticsUnavailable: boolean;
	}
}

export default function DashboardView(handle: Handle<DashboardView.Props>) {
	return () => {
		let props = handle.props;

		return (
			<div>
				{props.analyticsUnavailable && (
					<EmptyState message="Analytics data temporarily unavailable. Please retry later." />
				)}

				<div
					mix={[
						css({
							display: "flex",
							flexWrap: "wrap",
							gap: 16,
							marginBottom: 24,
						}),
					]}
				>
					<StatCard label="HTTP monitors" value={props.monitorCount} />
					<StatCard
						label="Uptime (24h)"
						value={props.uptimePercent === null ? "—" : `${props.uptimePercent}%`}
					/>
					<StatCard
						label="Slowest response (24h)"
						value={props.slowestResponseMs === null ? "—" : `${props.slowestResponseMs}ms`}
					/>
					<StatCard
						label="SSL certificates"
						value={
							<div mix={[css({ display: "flex", flexWrap: "wrap", gap: 8 })]}>
								<Badge tone="up">{props.sslCounts.valid} valid</Badge>
								<Badge tone="degraded">{props.sslCounts.expiring} expiring</Badge>
								<Badge tone="down">{props.sslCounts.expired} expired</Badge>
							</div>
						}
					/>
				</div>

				<Frame
					name="dashboard-panel"
					src={routes.app.team.dashboardPanel.href({ team: props.team.slug, type: props.tab })}
				/>
			</div>
		);
	};
}
