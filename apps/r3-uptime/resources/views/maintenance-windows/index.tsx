/**
 * Maintenance windows list page. Buckets windows into active/upcoming/past using the
 * same recurring-aware `MaintenanceWindow.isActiveAt` the alert dispatcher uses, so
 * this page and alert suppression never disagree about what's "active right now."
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type { SelectMaintenanceWindow, SelectMonitor } from "~/database/schema";

import MaintenanceWindow from "~/app/data/maintenance-window";
import * as s from "~/resources/styles";
import routes from "~/routes/web";

namespace MaintenanceWindowsView {
	export interface Props {
		team: { slug: string };
		windows: SelectMaintenanceWindow[];
		monitorsById: Map<string, SelectMonitor>;
	}
}

export default function MaintenanceWindowsView(handle: Handle<MaintenanceWindowsView.Props>) {
	return () => {
		let { team, windows, monitorsById } = handle.props;
		let now = Date.now();

		let active = windows.filter((window) => MaintenanceWindow.isActiveAt(window, now));
		let upcoming = windows.filter((window) => !active.includes(window) && window.starts_at > now);
		let past = windows.filter((window) => !active.includes(window) && !upcoming.includes(window));

		return (
			<div>
				<div mix={[s.row]}>
					<h1>Maintenance windows</h1>
					<a
						href={routes.app.team.maintenanceWindowNew.href({ team: team.slug })}
						mix={[s.buttonPrimary]}
					>
						New maintenance window
					</a>
				</div>

				{windows.length === 0 ? (
					<div mix={[s.emptyState]}>
						<p>No maintenance windows yet.</p>
						<a
							href={routes.app.team.maintenanceWindowNew.href({ team: team.slug })}
							mix={[s.buttonPrimary]}
						>
							Schedule your first maintenance window
						</a>
					</div>
				) : (
					<>
						{Section("Active", active, team, monitorsById)}
						{Section("Upcoming", upcoming, team, monitorsById)}
						{Section("Past", past, team, monitorsById)}
					</>
				)}
			</div>
		);
	};
}

function Section(
	title: string,
	windows: SelectMaintenanceWindow[],
	team: { slug: string },
	monitorsById: Map<string, SelectMonitor>,
) {
	if (windows.length === 0) return null;

	return (
		<div>
			<h2>{title}</h2>
			<table mix={[s.table]}>
				<thead>
					<tr>
						<th>Name</th>
						<th>Scope</th>
						<th>Starts</th>
						<th>Ends</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{windows.map((window) => (
						<tr key={window.id}>
							<td>
								{window.name}
								{window.is_recurring && <span mix={[s.badge, s.badgeNeutral]}>Recurring</span>}
								{window.ended_early_at !== null && (
									<span mix={[s.badge, s.badgeNeutral]}>Ended early</span>
								)}
							</td>
							<td>
								{window.monitor_id
									? (monitorsById.get(window.monitor_id)?.name ?? "Unknown monitor")
									: "All monitors"}
							</td>
							<td>{new Date(window.starts_at).toLocaleString()}</td>
							<td>{new Date(window.ends_at).toLocaleString()}</td>
							<td>
								<a
									href={routes.app.team.maintenanceWindowEdit.href({
										team: team.slug,
										windowId: window.id,
									})}
									mix={[s.link]}
								>
									Edit
								</a>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
