/**
 * TCP monitors list page. Renders every TCP monitor for the team with its last-known
 * status, or an empty state when there are none yet.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type { SelectTcpMonitor } from "~/database/schema";
import type { BadgeTone } from "~/resources/components/badge";

import Badge from "~/resources/components/badge";
import EmptyState from "~/resources/components/empty-state";
import * as s from "~/resources/styles";
import routes from "~/routes/web";

namespace TcpMonitorsView {
	export interface Props {
		team: { slug: string };
		monitors: SelectTcpMonitor[];
	}
}

const STATUS_BADGE_TONE: Record<string, BadgeTone> = {
	up: "up",
	timeout: "degraded",
	down: "down",
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
					<EmptyState
						message="No TCP monitors yet."
						action={{
							href: routes.app.team.tcpMonitorNew.href({ team: team.slug }),
							label: "Create your first TCP monitor",
						}}
					/>
				) : (
					<div mix={[s.tableScroll]}>
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
											{!monitor.is_enabled && <Badge tone="neutral">Disabled</Badge>}
										</td>
										<td>
											<code>
												{monitor.host}:{monitor.port}
											</code>
										</td>
										<td>
											<Badge tone={STATUS_BADGE_TONE[monitor.last_status ?? ""] ?? "neutral"}>
												{monitor.last_status ?? "pending"}
											</Badge>
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
					</div>
				)}
			</div>
		);
	};
}
