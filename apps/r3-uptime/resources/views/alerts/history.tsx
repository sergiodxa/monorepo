/**
 * Alert history page: the team's most recent delivery attempts across every alert.
 * Uses the event's own `monitor_name` snapshot rather than joining back to a monitor
 * table (which one to join depends on `monitor_type`, and the monitor may since have
 * been deleted) — see `docs/alerts.md`'s alert-history rules.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { BellIcon, HistoryIcon } from "@pkg/lucide-remix";
import { css } from "remix/ui";

import type { SelectAlert, SelectAlertEvent } from "~/database/schema";
import type { BadgeTone } from "~/resources/components/badge";

import Badge from "~/resources/components/badge";
import Empty from "~/resources/components/empty";
import LinkButton from "~/resources/components/link-button";
import { neutral } from "~/resources/theme";
import routes from "~/routes/web";

namespace AlertHistoryView {
	export interface Props {
		team: { slug: string };
		events: SelectAlertEvent[];
		alertsById: Map<string, SelectAlert>;
	}
}

const STATUS_BADGE_TONE: Record<string, BadgeTone> = {
	sent: "up",
	skipped_cooldown: "neutral",
	failed: "down",
};

const EVENT_TYPE_BADGE_TONE: Record<string, BadgeTone> = {
	up: "up",
	degraded: "degraded",
	down: "down",
};

/** Renders the delivery-attempt table, or an empty state when no alert has fired yet. */
export default function AlertHistoryView(handle: Handle<AlertHistoryView.Props>) {
	return () => {
		let { team, events, alertsById } = handle.props;

		return (
			<div>
				{events.length === 0 ? (
					<Empty>
						<Empty.Icon>
							<HistoryIcon size={24} strokeWidth={1.5} />
						</Empty.Icon>
						<Empty.Title>No alert events yet</Empty.Title>
						<Empty.Description>
							Alert events will appear here when monitors trigger alerts. Configure alerts to get
							started.
						</Empty.Description>
						<Empty.Action>
							<LinkButton href={routes.app.team.alerts.index.href({ team: team.slug })}>
								<BellIcon size={20} strokeWidth={1.5} />
								View Alerts
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
									<th>Alert</th>
									<th>Monitor</th>
									<th>Event</th>
									<th>Status</th>
									<th>Sent at</th>
								</tr>
							</thead>
							<tbody>
								{events.map((event) => (
									<tr key={event.id}>
										<td>{alertsById.get(event.alert_id)?.name ?? "Deleted alert"}</td>
										<td>{event.monitor_name ?? "Unknown monitor"}</td>
										<td>
											<Badge tone={EVENT_TYPE_BADGE_TONE[event.event_type] ?? "neutral"}>
												{event.event_type}
											</Badge>
										</td>
										<td>
											<Badge tone={STATUS_BADGE_TONE[event.status] ?? "neutral"}>
												{event.status}
											</Badge>
											{event.error_message && (
												<p
													mix={[
														css({
															fontSize: "0.8125rem",
															color: neutral[500],
															"@media (prefers-color-scheme: dark)": { color: neutral[400] },
														}),
													]}
												>
													{event.error_message}
												</p>
											)}
										</td>
										<td>{new Date(event.sent_at).toLocaleString()}</td>
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
