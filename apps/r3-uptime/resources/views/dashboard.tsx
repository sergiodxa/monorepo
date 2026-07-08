/**
 * Team dashboard view. Shows stat cards (monitor count, 24h uptime, slowest response)
 * and a tabbed monitor table. Only the HTTP tab has real content in this phase — DNS,
 * TCP, and cron-job monitoring land in later phases; their tabs are already wired so
 * this page doesn't need reshaping when they arrive.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type { MonitorHealth } from "~/app/services/analytics";
import type { SelectMonitor } from "~/database/schema";

import * as s from "~/resources/styles";
import routes from "~/routes/web";

export type DashboardTab = "http" | "dns" | "tcp" | "cron-jobs";

const TABS: Array<{ id: DashboardTab; label: string }> = [
	{ id: "http", label: "HTTP" },
	{ id: "dns", label: "DNS" },
	{ id: "tcp", label: "TCP" },
	{ id: "cron-jobs", label: "Cron jobs" },
];

const HEALTH_BADGE_MIX: Record<MonitorHealth, typeof s.badgeUp> = {
	up: s.badgeUp,
	degraded: s.badgeDegraded,
	down: s.badgeDown,
	pending: s.badgeNeutral,
};

namespace DashboardView {
	export interface Props {
		team: { slug: string; name: string };
		tab: DashboardTab;
		monitorCount: number;
		uptimePercent: number | null;
		slowestResponseMs: number | null;
		httpRows: Array<{ monitor: SelectMonitor; health: MonitorHealth }>;
		analyticsUnavailable: boolean;
	}
}

export default function DashboardView(handle: Handle<DashboardView.Props>) {
	return () => {
		let props = handle.props;

		return (
			<div>
				<h1>{props.team.name}</h1>

				{props.analyticsUnavailable && (
					<div mix={[s.emptyState]}>
						<p>Analytics data temporarily unavailable. Please retry later.</p>
					</div>
				)}

				<div mix={[s.statRow]}>
					<div mix={[s.statCard]}>
						<div mix={[s.mutedSmall]}>HTTP monitors</div>
						<div mix={[s.statValue]}>{props.monitorCount}</div>
					</div>
					<div mix={[s.statCard]}>
						<div mix={[s.mutedSmall]}>Uptime (24h)</div>
						<div mix={[s.statValue]}>
							{props.uptimePercent === null ? "—" : `${props.uptimePercent}%`}
						</div>
					</div>
					<div mix={[s.statCard]}>
						<div mix={[s.mutedSmall]}>Slowest response (24h)</div>
						<div mix={[s.statValue]}>
							{props.slowestResponseMs === null ? "—" : `${props.slowestResponseMs}ms`}
						</div>
					</div>
				</div>

				<nav mix={[s.row]}>
					{TABS.map((tab) => (
						<a
							key={tab.id}
							href={`${routes.app.team.dashboard.href({ team: props.team.slug })}?tab=${tab.id}`}
							aria-current={tab.id === props.tab ? "page" : undefined}
							mix={[s.link]}
						>
							{tab.label}
						</a>
					))}
				</nav>

				{props.tab === "http" ? (
					HttpTable({ team: props.team, rows: props.httpRows })
				) : (
					<div mix={[s.emptyState]}>
						<p>This monitor type isn't available yet.</p>
					</div>
				)}
			</div>
		);
	};
}

function HttpTable(props: {
	team: { slug: string };
	rows: Array<{ monitor: SelectMonitor; health: MonitorHealth }>;
}) {
	if (props.rows.length === 0) {
		return (
			<div mix={[s.emptyState]}>
				<p>No HTTP monitors yet.</p>
				<a
					href={routes.app.team.monitorNew.href({ team: props.team.slug })}
					mix={[s.buttonPrimary]}
				>
					Create your first monitor
				</a>
			</div>
		);
	}

	return (
		<table mix={[s.table]}>
			<thead>
				<tr>
					<th>Name</th>
					<th>Status</th>
				</tr>
			</thead>
			<tbody>
				{props.rows.map(({ monitor, health }) => (
					<tr key={monitor.id}>
						<td>
							<a
								href={routes.app.team.monitorShow.href({
									team: props.team.slug,
									monitorId: monitor.id,
								})}
								mix={[s.link]}
							>
								{monitor.name}
							</a>
						</td>
						<td>
							<span mix={[s.badge, HEALTH_BADGE_MIX[health]]}>{health}</span>
						</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}
