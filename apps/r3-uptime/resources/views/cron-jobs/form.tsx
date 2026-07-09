/**
 * Shared cron-job monitor form fields, used by both the new-monitor and edit-monitor
 * views. It exists so the two pages don't duplicate the field markup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import type { SelectCronJobMonitor } from "~/database/schema";

import Field from "~/resources/components/field";

const neutral = {
	50: "oklch(0.98 0.005 145)",
	200: "oklch(0.91 0.008 145)",
	700: "oklch(0.42 0.008 145)",
	900: "oklch(0.24 0.005 145)",
} as const;

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
				<Field label="Name">
					<input
						type="text"
						name="name"
						required
						defaultValue={monitor?.name}
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

				<Field label="Description (optional)">
					<input
						type="text"
						name="description"
						defaultValue={monitor?.description ?? ""}
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

				<Field label="Cron expression">
					<input
						type="text"
						name="cron_expression"
						required
						defaultValue={monitor?.cron_expression ?? "0 * * * *"}
						placeholder="0 * * * *"
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

				<Field label="Timezone">
					<input
						type="text"
						name="timezone"
						required
						defaultValue={monitor?.timezone ?? "UTC"}
						placeholder="UTC"
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

				<Field label="Grace period (seconds)">
					<input
						type="number"
						name="grace_period_seconds"
						min={60}
						max={86_400}
						defaultValue={monitor?.grace_period_seconds ?? 300}
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

				<label
					mix={[
						css({
							display: "flex",
							alignItems: "center",
							gap: 8,
							marginBottom: 16,
							fontSize: "0.875rem",
						}),
					]}
				>
					<input
						type="checkbox"
						name="alert_on_late"
						value="true"
						defaultChecked={monitor?.alert_on_late ?? false}
					/>
					<span>Alert when late (not just when missed)</span>
				</label>

				<label
					mix={[
						css({
							display: "flex",
							alignItems: "center",
							gap: 8,
							marginBottom: 16,
							fontSize: "0.875rem",
						}),
					]}
				>
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
