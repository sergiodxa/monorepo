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

import type { SelectAlert, SelectAlertEvent } from "~/database/schema";
import type { BadgeTone } from "~/resources/components/badge";

import Badge from "~/resources/components/badge";
import EmptyState from "~/resources/components/empty-state";
import * as s from "~/resources/styles";

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

export default function AlertHistoryView(handle: Handle<AlertHistoryView.Props>) {
	return () => {
		let { events, alertsById } = handle.props;

		return (
			<div>
				<h1>Alert history</h1>

				{events.length === 0 ? (
					<EmptyState message="No alert events yet." />
				) : (
					<div mix={[s.tableScroll]}>
						<table mix={[s.table]}>
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
											{event.error_message && <p mix={[s.mutedSmall]}>{event.error_message}</p>}
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
