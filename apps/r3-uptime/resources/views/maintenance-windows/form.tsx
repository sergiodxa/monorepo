/**
 * Shared maintenance-window form fields, used by both the new-window and edit-window
 * views. Only HTTP monitors can be individually targeted, matching alerts (see
 * `app/data/maintenance-window.ts`'s docblock).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type { SelectMaintenanceWindow, SelectMonitor } from "~/database/schema";

import Field from "~/resources/components/field";
import * as s from "~/resources/styles";

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

export default function MaintenanceWindowFormFields(
	handle: Handle<MaintenanceWindowFormFields.Props>,
) {
	return () => {
		let { monitors, window } = handle.props;

		return (
			<>
				<Field label="Name">
					<input type="text" name="name" required defaultValue={window?.name} mix={[s.input]} />
				</Field>

				<Field label="Scope">
					<select name="monitor_id" defaultValue={window?.monitor_id ?? ""} mix={[s.selectInput]}>
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
						mix={[s.input]}
					/>
				</Field>

				<Field label="Ends at">
					<input
						type="datetime-local"
						name="ends_at"
						required
						defaultValue={window ? toDatetimeLocal(window.ends_at) : undefined}
						mix={[s.input]}
					/>
				</Field>

				<label mix={[s.checkboxField]}>
					<input
						type="checkbox"
						name="suppress_alerts"
						value="true"
						defaultChecked={window?.suppress_alerts ?? true}
					/>
					<span>Suppress alerts during this window</span>
				</label>

				<label mix={[s.checkboxField]}>
					<input
						type="checkbox"
						name="show_on_status_page"
						value="true"
						defaultChecked={window?.show_on_status_page ?? true}
					/>
					<span>Show on status page</span>
				</label>

				<label mix={[s.checkboxField]}>
					<input
						type="checkbox"
						name="is_recurring"
						value="true"
						defaultChecked={window?.is_recurring ?? false}
					/>
					<span>Recurring</span>
				</label>

				<Field label="Recurrence pattern (when recurring)">
					<input
						type="text"
						name="recurring_pattern"
						defaultValue={window?.recurring_pattern ?? ""}
						placeholder="weekly:monday:02:00-04:00"
						mix={[s.input]}
					/>
					<p mix={[s.mutedSmall]}>
						<code>daily:HH:MM-HH:MM</code>, <code>weekly:&lt;day&gt;:HH:MM-HH:MM</code>, or{" "}
						<code>monthly:&lt;day-of-month&gt;:HH:MM-HH:MM</code>, in UTC.
					</p>
				</Field>
			</>
		);
	};
}
