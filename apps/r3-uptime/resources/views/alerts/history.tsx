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

import * as s from "~/resources/styles";

namespace AlertHistoryView {
	export interface Props {
		team: { slug: string };
		events: SelectAlertEvent[];
		alertsById: Map<string, SelectAlert>;
	}
}

const STATUS_BADGE_MIX: Record<string, typeof s.badgeUp> = {
	sent: s.badgeUp,
	skipped_cooldown: s.badgeNeutral,
	failed: s.badgeDown,
};

const EVENT_TYPE_BADGE_MIX: Record<string, typeof s.badgeUp> = {
	up: s.badgeUp,
	degraded: s.badgeDegraded,
	down: s.badgeDown,
};

export default function AlertHistoryView(handle: Handle<AlertHistoryView.Props>) {
	return () => {
		let { events, alertsById } = handle.props;

		return (
			<div>
				<h1>Alert history</h1>

				{events.length === 0 ? (
					<div mix={[s.emptyState]}>
						<p>No alert events yet.</p>
					</div>
				) : (
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
										<span mix={[s.badge, EVENT_TYPE_BADGE_MIX[event.event_type] ?? s.badgeNeutral]}>
											{event.event_type}
										</span>
									</td>
									<td>
										<span mix={[s.badge, STATUS_BADGE_MIX[event.status] ?? s.badgeNeutral]}>
											{event.status}
										</span>
										{event.error_message && <p mix={[s.mutedSmall]}>{event.error_message}</p>}
									</td>
									<td>{new Date(event.sent_at).toLocaleString()}</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>
		);
	};
}
