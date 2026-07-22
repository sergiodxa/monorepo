/**
 * Shared maintenance-window form fields, used by both the new-window and edit-window
 * views. Only HTTP monitors can be individually targeted, matching alerts (see
 * `app/data/maintenance-window.ts`'s docblock).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { getContext } from "remix/async-context-middleware";
import type { Handle } from "remix/ui";

import { Input, Label, Select, TextField } from "@pkg/r3-ui";
import { fieldStackLayout } from "@pkg/r3-ui/styles";
import { css } from "remix/ui";

import type { SelectMaintenanceWindow, SelectMonitor } from "~/database/schema";

import Field from "~/resources/components/field";
import Switch from "~/resources/components/switch";

namespace MaintenanceWindowFormFields {
	export interface Props {
		monitors: SelectMonitor[];
		window?: SelectMaintenanceWindow;
		/** The request's i18next instance, used to read this shared form's `page.maintenanceWindows.form.fields.*` copy. */
		i18next: ReturnType<typeof getContext>["i18next"];
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
		let { monitors, window, i18next } = handle.props;
		let t = i18next.getFixedT(null, "translation", "page.maintenanceWindows.form.fields");

		return (
			<>
				<TextField
					label={t("name.label")}
					type="text"
					name="name"
					required
					defaultValue={window?.name}
					mix={css({ marginBottom: 28 })}
				/>

				<Field label={t("scope.label")}>
					<Select name="monitor_id" defaultValue={window?.monitor_id ?? ""}>
						<Select.Option value="">{t("scope.allMonitors")}</Select.Option>
						{monitors.map((monitor) => (
							<Select.Option key={monitor.id} value={monitor.id}>
								{monitor.name} (HTTP)
							</Select.Option>
						))}
					</Select>
				</Field>

				<div mix={[fieldStackLayout(), css({ marginBottom: 28 })]}>
					<Label htmlFor="maintenance-window-starts-at">{t("startsAt.label")}</Label>
					<Input
						id="maintenance-window-starts-at"
						type="datetime-local"
						name="starts_at"
						required
						defaultValue={window ? toDatetimeLocal(window.starts_at) : undefined}
					/>
				</div>

				<div mix={[fieldStackLayout(), css({ marginBottom: 28 })]}>
					<Label htmlFor="maintenance-window-ends-at">{t("endsAt.label")}</Label>
					<Input
						id="maintenance-window-ends-at"
						type="datetime-local"
						name="ends_at"
						required
						defaultValue={window ? toDatetimeLocal(window.ends_at) : undefined}
					/>
				</div>

				<Switch name="suppress_alerts" defaultChecked={window?.suppress_alerts ?? true}>
					{t("suppressAlerts.label")}
				</Switch>

				<Switch name="show_on_status_page" defaultChecked={window?.show_on_status_page ?? true}>
					{t("showOnStatusPage.label")}
				</Switch>

				<Switch name="is_recurring" defaultChecked={window?.is_recurring ?? false}>
					{t("recurring.label")}
				</Switch>

				<TextField
					label={t("recurringPattern.label")}
					name="recurring_pattern"
					defaultValue={window?.recurring_pattern ?? ""}
					placeholder={t("recurringPattern.placeholder")}
					description={t("recurringPattern.description")}
					mix={css({ marginBottom: 28 })}
				/>
			</>
		);
	};
}
