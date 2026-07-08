/**
 * Shared cron-job monitor form fields, used by both the new-monitor and edit-monitor
 * views. It exists so the two pages don't duplicate the field markup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type { SelectCronJobMonitor } from "~/database/schema";

import * as s from "~/resources/styles";

namespace CronJobFormFields {
	export interface Props {
		/** Existing monitor values when editing; omitted when creating. */
		monitor?: SelectCronJobMonitor;
	}
}

export default function CronJobFormFields(handle: Handle<CronJobFormFields.Props>) {
	return () => {
		let monitor = handle.props.monitor;

		return (
			<>
				<label mix={[s.field]}>
					<span>Name</span>
					<input type="text" name="name" required defaultValue={monitor?.name} mix={[s.input]} />
				</label>

				<label mix={[s.field]}>
					<span>Description (optional)</span>
					<input
						type="text"
						name="description"
						defaultValue={monitor?.description ?? ""}
						mix={[s.input]}
					/>
				</label>

				<label mix={[s.field]}>
					<span>Cron expression</span>
					<input
						type="text"
						name="cron_expression"
						required
						defaultValue={monitor?.cron_expression ?? "0 * * * *"}
						placeholder="0 * * * *"
						mix={[s.input]}
					/>
				</label>

				<label mix={[s.field]}>
					<span>Timezone</span>
					<input
						type="text"
						name="timezone"
						required
						defaultValue={monitor?.timezone ?? "UTC"}
						placeholder="UTC"
						mix={[s.input]}
					/>
				</label>

				<label mix={[s.field]}>
					<span>Grace period (seconds)</span>
					<input
						type="number"
						name="grace_period_seconds"
						min={60}
						max={86_400}
						defaultValue={monitor?.grace_period_seconds ?? 300}
						mix={[s.input]}
					/>
				</label>

				<label mix={[s.checkboxField]}>
					<input
						type="checkbox"
						name="alert_on_late"
						value="true"
						defaultChecked={monitor?.alert_on_late ?? false}
					/>
					<span>Alert when late (not just when missed)</span>
				</label>

				<label mix={[s.checkboxField]}>
					<input
						type="checkbox"
						name="is_enabled"
						value="true"
						defaultChecked={monitor ? monitor.enabled_at !== null : true}
					/>
					<span>Enabled</span>
				</label>
			</>
		);
	};
}
