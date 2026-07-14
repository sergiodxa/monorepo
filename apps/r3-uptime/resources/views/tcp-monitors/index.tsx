/**
 * TCP monitors list page. Renders every TCP monitor for the team with its last-known
 * status, or an empty state when there are none yet.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { NetworkIcon, PlusIcon } from "@pkg/lucide-remix";
import { css } from "remix/ui";

import type { SelectTcpMonitor } from "~/database/schema";
import type { BadgeTone } from "~/resources/components/badge";

import Badge from "~/resources/components/badge";
import Empty from "~/resources/components/empty";
import LinkButton from "~/resources/components/link-button";
import { neutral, primary } from "~/resources/theme";
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

/** Renders the TCP monitor table with endpoint/status/response time, or an empty state with a create CTA. */
export default function TcpMonitorsView(handle: Handle<TcpMonitorsView.Props>) {
	return () => {
		let { team, monitors } = handle.props;

		return (
			<div>
				{monitors.length === 0 ? (
					<Empty>
						<Empty.Icon>
							<NetworkIcon size={24} strokeWidth={1.5} />
						</Empty.Icon>
						<Empty.Title>No TCP monitors yet</Empty.Title>
						<Empty.Description>
							Create a TCP monitor to check if ports are open and responsive.
						</Empty.Description>
						<Empty.Action>
							<LinkButton href={routes.app.team.tcpMonitors.new.href({ team: team.slug })}>
								<PlusIcon size={20} strokeWidth={1.5} />
								Create TCP Monitor
							</LinkButton>
						</Empty.Action>
					</Empty>
				) : (
					<div mix={[css({ overflowX: "auto" })]}>
						<table
							mix={[
								css({
									width: "100%",
									borderCollapse: "collapse",
									fontSize: "0.875rem",
									"& th, & td": {
										textAlign: "left",
										padding: "12px 16px",
										borderBottom: `1px solid ${neutral[200]}`,
									},
									"@media (prefers-color-scheme: dark)": {
										"& th, & td": { borderColor: neutral[800] },
									},
								}),
							]}
						>
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
												href={routes.app.team.tcpMonitors.show.href({
													team: team.slug,
													monitorId: monitor.id,
												})}
												mix={[
													css({
														color: primary[600],
														textDecoration: "none",
														"&:hover": { textDecoration: "underline" },
														"@media (prefers-color-scheme: dark)": { color: primary[400] },
													}),
												]}
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
