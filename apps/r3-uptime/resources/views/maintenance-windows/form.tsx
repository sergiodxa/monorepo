/**
 * Shared maintenance-window form fields, used by both the new-window and edit-window
 * views. Only HTTP monitors can be individually targeted, matching alerts (see
 * `app/data/maintenance-window.ts`'s docblock).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import type { SelectMaintenanceWindow, SelectMonitor } from "~/database/schema";

import Field from "~/resources/components/field";
import Switch from "~/resources/components/switch";
import { mixForSelect } from "~/resources/mix-for-select";
import { neutral } from "~/resources/theme";

namespace MaintenanceWindowFormFields {
	export interface Props {
		monitors: SelectMonitor[];
		window?: SelectMaintenanceWindow;
	}
}

/** Formats an epoch-ms timestamp for a `datetime-local` input's default value. */
function toDatetimeLocal(epochMs: number): string {
	let date = new Date(epochMs);
	let pad = (n: number) => String(n).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Renders the scope/schedule/recurrence fields, pre-filled from `window` when editing. */
export default function MaintenanceWindowFormFields(
	handle: Handle<MaintenanceWindowFormFields.Props>,
) {
	return () => {
		let { monitors, window } = handle.props;

		return (
			<>
				<Field label="Name">
					<input
						type="text"
						name="name"
						required
						defaultValue={window?.name}
						mix={[
							css({
								padding: "8px 12px",
								borderRadius: 6,
								border: `1px solid ${neutral[200]}`,
								fontSize: "0.875rem",
								fontFamily: "inherit",
								background: neutral[50],
								color: "inherit",
								"@media (prefers-color-scheme: dark)": {
									borderColor: neutral[700],
									background: neutral[900],
								},
							}),
						]}
					/>
				</Field>

				<Field label="Scope">
					<select
						name="monitor_id"
						defaultValue={window?.monitor_id ?? ""}
						mix={[
							mixForSelect(
								css({
									padding: "8px 12px",
									// Matches the text inputs' rendered height: a native <select> is
									// intrinsically taller than a same-padding <input> unless pinned
									// to an explicit height.
									height: 34,
									borderRadius: 6,
									border: `1px solid ${neutral[200]}`,
									fontSize: "0.875rem",
									fontFamily: "inherit",
									background: neutral[50],
									color: "inherit",
									"@media (prefers-color-scheme: dark)": {
										borderColor: neutral[700],
										background: neutral[900],
									},
								}),
							),
						]}
					>
						<option value="">All monitors</option>
						{monitors.map((monitor) => (
							<option key={monitor.id} value={monitor.id}>
								{monitor.name} (HTTP)
							</option>
						))}
					</select>
				</Field>

				<Field label="Starts at">
					<input
						type="datetime-local"
						name="starts_at"
						required
						defaultValue={window ? toDatetimeLocal(window.starts_at) : undefined}
						mix={[
							css({
								padding: "8px 12px",
								borderRadius: 6,
								border: `1px solid ${neutral[200]}`,
								fontSize: "0.875rem",
								fontFamily: "inherit",
								background: neutral[50],
								color: "inherit",
								"@media (prefers-color-scheme: dark)": {
									borderColor: neutral[700],
									background: neutral[900],
								},
							}),
						]}
					/>
				</Field>

				<Field label="Ends at">
					<input
						type="datetime-local"
						name="ends_at"
						required
						defaultValue={window ? toDatetimeLocal(window.ends_at) : undefined}
						mix={[
							css({
								padding: "8px 12px",
								borderRadius: 6,
								border: `1px solid ${neutral[200]}`,
								fontSize: "0.875rem",
								fontFamily: "inherit",
								background: neutral[50],
								color: "inherit",
								"@media (prefers-color-scheme: dark)": {
									borderColor: neutral[700],
									background: neutral[900],
								},
							}),
						]}
					/>
				</Field>

				<Switch name="suppress_alerts" defaultChecked={window?.suppress_alerts ?? true}>
					Suppress alerts during this window
				</Switch>

				<Switch name="show_on_status_page" defaultChecked={window?.show_on_status_page ?? true}>
					Show on status page
				</Switch>

				<Switch name="is_recurring" defaultChecked={window?.is_recurring ?? false}>
					Recurring
				</Switch>

				<Field label="Recurrence pattern (when recurring)">
					<input
						type="text"
						name="recurring_pattern"
						defaultValue={window?.recurring_pattern ?? ""}
						placeholder="weekly:monday:02:00-04:00"
						mix={[
							css({
								padding: "8px 12px",
								borderRadius: 6,
								border: `1px solid ${neutral[200]}`,
								fontSize: "0.875rem",
								fontFamily: "inherit",
								background: neutral[50],
								color: "inherit",
								"@media (prefers-color-scheme: dark)": {
									borderColor: neutral[700],
									background: neutral[900],
								},
							}),
						]}
					/>
					<p
						mix={[
							css({
								fontSize: "0.8125rem",
								color: neutral[500],
								"@media (prefers-color-scheme: dark)": { color: neutral[400] },
							}),
						]}
					>
						<code>daily:HH:MM-HH:MM</code>, <code>weekly:&lt;day&gt;:HH:MM-HH:MM</code>, or{" "}
						<code>monthly:&lt;day-of-month&gt;:HH:MM-HH:MM</code>, in UTC.
					</p>
				</Field>
			</>
		);
	};
}
