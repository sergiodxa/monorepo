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

import { css } from "remix/ui";

import type { SelectAlert, SelectAlertEvent } from "~/database/schema";
import type { BadgeTone } from "~/resources/components/badge";

import Badge from "~/resources/components/badge";
import EmptyState from "~/resources/components/empty-state";

namespace AlertHistoryView {
	export interface Props {
		team: { slug: string };
		events: SelectAlertEvent[];
		alertsById: Map<string, SelectAlert>;
	}
}

const neutral = {
	200: "oklch(0.91 0.008 145)",
	400: "oklch(0.73 0.01 145)",
	500: "oklch(0.62 0.01 145)",
	800: "oklch(0.32 0.006 145)",
} as const;

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
