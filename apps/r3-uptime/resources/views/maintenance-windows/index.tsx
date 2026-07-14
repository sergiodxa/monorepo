/**
 * Maintenance windows list page. Buckets windows into active/upcoming/past using the
 * same recurring-aware `MaintenanceWindow.isActiveAt` the alert dispatcher uses, so
 * this page and alert suppression never disagree about what's "active right now."
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { PlusIcon, WrenchIcon } from "@pkg/lucide-remix";
import { css } from "remix/ui";

import type { SelectMaintenanceWindow, SelectMonitor } from "~/database/schema";

import MaintenanceWindow from "~/app/data/maintenance-window";
import Badge from "~/resources/components/badge";
import Empty from "~/resources/components/empty";
import LinkButton from "~/resources/components/link-button";
import { neutral, primary } from "~/resources/theme";
import routes from "~/routes/web";

namespace MaintenanceWindowsView {
	export interface Props {
		team: { slug: string };
		windows: SelectMaintenanceWindow[];
		monitorsById: Map<string, SelectMonitor>;
	}
}

/** Renders the team's maintenance windows split into "Active"/"Upcoming"/"Past" sections (each hidden when empty), or an empty state with a schedule CTA when there are none at all. */
export default function MaintenanceWindowsView(handle: Handle<MaintenanceWindowsView.Props>) {
	return () => {
		let { team, windows, monitorsById } = handle.props;
		let now = Date.now();

		let active = windows.filter((window) => MaintenanceWindow.isActiveAt(window, now));
		let upcoming = windows.filter((window) => !active.includes(window) && window.starts_at > now);
		let past = windows.filter((window) => !active.includes(window) && !upcoming.includes(window));

		return (
			<div>
				{windows.length === 0 ? (
					<Empty>
						<Empty.Icon>
							<WrenchIcon size={24} strokeWidth={1.5} />
						</Empty.Icon>
						<Empty.Title>No maintenance windows</Empty.Title>
						<Empty.Description>
							Schedule maintenance windows to suppress alerts during planned downtime.
						</Empty.Description>
						<Empty.Action>
							<LinkButton href={routes.app.team.maintenanceWindows.new.href({ team: team.slug })}>
								<PlusIcon size={20} strokeWidth={1.5} />
								Schedule Maintenance
							</LinkButton>
						</Empty.Action>
					</Empty>
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
									{window.is_recurring && <Badge tone="neutral">Recurring</Badge>}
									{window.ended_early_at !== null && <Badge tone="neutral">Ended early</Badge>}
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
										href={routes.app.team.maintenanceWindows.edit.href({
											team: team.slug,
											windowId: window.id,
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
										Edit
									</a>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
