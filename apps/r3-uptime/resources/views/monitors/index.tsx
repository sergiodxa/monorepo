/**
 * HTTP monitors list page. Renders every monitor for the team with its 24h health
 * badge, or an empty state when there are none yet. It exists as the overview of a
 * team's HTTP uptime checks.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type { MonitorHealth } from "~/app/services/analytics";
import type { SelectMonitor } from "~/database/schema";

import * as s from "~/resources/styles";
import routes from "~/routes/web";

namespace HttpMonitorsView {
	export interface Row {
		monitor: SelectMonitor;
		health: MonitorHealth;
	}

	export interface Props {
		team: { slug: string };
		rows: Row[];
	}
}

const HEALTH_BADGE_MIX: Record<MonitorHealth, typeof s.badgeUp> = {
	up: s.badgeUp,
	degraded: s.badgeDegraded,
	down: s.badgeDown,
	pending: s.badgeNeutral,
};

export default function HttpMonitorsView(handle: Handle<HttpMonitorsView.Props>) {
	return () => {
		let { team, rows } = handle.props;

		return (
			<div>
				<div mix={[s.row]}>
					<h1>HTTP monitors</h1>
					<a href={routes.app.team.monitorNew.href({ team: team.slug })} mix={[s.buttonPrimary]}>
						New monitor
					</a>
				</div>

				{rows.length === 0 ? (
					<div mix={[s.emptyState]}>
						<p>No monitors yet.</p>
						<a href={routes.app.team.monitorNew.href({ team: team.slug })} mix={[s.buttonPrimary]}>
							Create your first monitor
						</a>
					</div>
				) : (
					<table mix={[s.table]}>
						<thead>
							<tr>
								<th>Name</th>
								<th>URL</th>
								<th>Status</th>
							</tr>
						</thead>
						<tbody>
							{rows.map(({ monitor, health }) => (
								<tr key={monitor.id}>
									<td>
										<a
											href={routes.app.team.monitorShow.href({
												team: team.slug,
												monitorId: monitor.id,
											})}
											mix={[s.link]}
										>
											{monitor.name}
										</a>
									</td>
									<td>
										<code>{monitor.url}</code>
									</td>
									<td>
										<span mix={[s.badge, HEALTH_BADGE_MIX[health]]}>{health}</span>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>
		);
	};
}
