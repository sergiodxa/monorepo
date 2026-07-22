/**
 * Shared cron-job monitor form fields, used by both the new-monitor and edit-monitor
 * views. The cron expression starts blank on create, forcing a deliberate choice
 * instead of silently scheduling an hourly job. It exists so the two pages don't
 * duplicate the field markup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { getContext } from "remix/async-context-middleware";
import type { Handle } from "remix/ui";

import { Label, NumberField, TextField } from "@pkg/r3-ui";
import { css } from "remix/ui";

import type { SelectCronJobMonitor } from "~/database/schema";

import Switch from "~/resources/components/switch";

/** Stable id linking the grace-period field's `Label` to its `NumberField.Input`. */
const GRACE_PERIOD_INPUT_ID = "cron-job-grace-period-seconds";

namespace CronJobFormFields {
	export interface Props {
		/** Existing monitor values when editing; omitted when creating. */
		monitor?: SelectCronJobMonitor;
		/** The request's i18next instance, used to read this page's `form.fields.*` copy. */
		i18next: ReturnType<typeof getContext>["i18next"];
		/** Which page is rendering these fields, selecting the `page.<page>.form.fields.*` keys to read. */
		page: "createCronJob" | "editCronJob";
	}
}

/** Renders the name/description/cron-expression/grace-period/timezone/alert fields, pre-filled from `monitor` when editing and left blank (except for a UTC timezone default) when creating. */
export default function CronJobFormFields(handle: Handle<CronJobFormFields.Props>) {
	return () => {
		let { monitor, i18next, page } = handle.props;
		let t = i18next.getFixedT(null, "translation", `page.${page}.form.fields`);

		return (
			<>
				<TextField
					label={t("name.label")}
					type="text"
					name="name"
					required
					defaultValue={monitor?.name}
					placeholder={t("name.placeholder")}
					description={t("name.description")}
					mix={css({ marginBottom: 28 })}
				/>

				<TextField
					label={t("description.label")}
					type="text"
					name="description"
					defaultValue={monitor?.description ?? ""}
					placeholder={t("description.placeholder")}
					description={t("description.description")}
					mix={css({ marginBottom: 28 })}
				/>

				<TextField
					label={t("cronExpression.label")}
					type="text"
					name="cron_expression"
					required
					defaultValue={monitor?.cron_expression ?? ""}
					placeholder={t("cronExpression.placeholder")}
					description={t("cronExpression.description")}
					mix={css({ marginBottom: 28 })}
				/>

				<NumberField mix={css({ marginBottom: 28 })}>
					<Label htmlFor={GRACE_PERIOD_INPUT_ID}>
						{t("gracePeriod.label")} ({t("gracePeriod.unit.seconds")})
					</Label>
					<NumberField.Group>
						<NumberField.DecrementButton aria-label={t("gracePeriod.decrement")} />
						<NumberField.Input
							id={GRACE_PERIOD_INPUT_ID}
							name="grace_period_seconds"
							min={60}
							max={86_400}
							defaultValue={monitor?.grace_period_seconds ?? 300}
						/>
						<NumberField.IncrementButton aria-label={t("gracePeriod.increment")} />
					</NumberField.Group>
				</NumberField>

				<TextField
					label={t("timezone.label")}
					type="text"
					name="timezone"
					required
					defaultValue={monitor?.timezone ?? "UTC"}
					placeholder={t("timezone.placeholder")}
					description={t("timezone.description")}
					mix={css({ marginBottom: 28 })}
				/>

				<Switch name="alert_on_late" defaultChecked={monitor?.alert_on_late ?? false}>
					{t("alertOnLate.label")}
				</Switch>

				<Switch name="is_enabled" defaultChecked={monitor ? monitor.enabled_at !== null : true}>
					{t("enabled.label")}
				</Switch>
			</>
		);
	};
}
