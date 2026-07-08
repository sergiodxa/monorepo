/**
 * TCP monitors list page. Renders every TCP monitor for the team with its last-known
 * status, or an empty state when there are none yet.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type { SelectTcpMonitor } from "~/database/schema";

import * as s from "~/resources/styles";
import routes from "~/routes/web";

namespace TcpMonitorsView {
	export interface Props {
		team: { slug: string };
		monitors: SelectTcpMonitor[];
	}
}

const STATUS_BADGE_MIX: Record<string, typeof s.badgeUp> = {
	up: s.badgeUp,
	timeout: s.badgeDegraded,
	down: s.badgeDown,
};

export default function TcpMonitorsView(handle: Handle<TcpMonitorsView.Props>) {
	return () => {
		let { team, monitors } = handle.props;

		return (
			<div>
				<div mix={[s.row]}>
					<h1>TCP monitors</h1>
					<a href={routes.app.team.tcpMonitorNew.href({ team: team.slug })} mix={[s.buttonPrimary]}>
						New TCP monitor
					</a>
				</div>

				{monitors.length === 0 ? (
					<div mix={[s.emptyState]}>
						<p>No TCP monitors yet.</p>
						<a
							href={routes.app.team.tcpMonitorNew.href({ team: team.slug })}
							mix={[s.buttonPrimary]}
						>
							Create your first TCP monitor
						</a>
					</div>
				) : (
					<table mix={[s.table]}>
						<thead>
							<tr>
								<th>Name</th>
								<th>Endpoint</th>
								<th>Status</th>
								<th>Response time</th>
							</tr>
						</thead>
						<tbody>
							{monitors.map((monitor) => (
								<tr key={monitor.id}>
									<td>
										<a
											href={routes.app.team.tcpMonitorShow.href({
												team: team.slug,
												monitorId: monitor.id,
											})}
											mix={[s.link]}
										>
											{monitor.name}
										</a>
										{!monitor.is_enabled && <span mix={[s.badge, s.badgeNeutral]}>Disabled</span>}
									</td>
									<td>
										<code>
											{monitor.host}:{monitor.port}
										</code>
									</td>
									<td>
										<span
											mix={[s.badge, STATUS_BADGE_MIX[monitor.last_status ?? ""] ?? s.badgeNeutral]}
										>
											{monitor.last_status ?? "pending"}
										</span>
									</td>
									<td>
										{monitor.last_response_time_ms === null
											? "—"
											: `${monitor.last_response_time_ms}ms`}
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
