/**
 * Shared cron-job monitor form, used by the new-monitor and edit-monitor pages and by the
 * actions that re-render them after a failed submit. Every field reads its value from
 * `values`, so a rejected submission comes back with what was typed and each field's issue.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";
import type { getContext } from "remix/middleware/async-context";

import { isSupportedTimeZone, timeZonesByRegion } from "@sdxc/dates";
import { vstack } from "@sdxc/u/layout";
import { Form, Select, Switch, TextField } from "@sdxc/ui";

import { withPrefix } from "~/app/services/prefixed-translate";
import { DEFAULT_TIMEZONE } from "~/config/timezones";
import Field from "~/resources/components/field";
import SettingsSection, { SETTINGS_SWITCH_GAP } from "~/resources/components/settings-section";
import StepperField from "~/resources/components/stepper-field";

/** Stable id linking the grace-period field's label to its number input. */
const GRACE_PERIOD_INPUT_ID = "cron-job-grace-period-seconds";

/** What the form shows in each field: a stored monitor's values, or what was just submitted. */
export interface CronJobFormValues {
	name: string;
	description: string;
	cron_expression: string;
	grace_period_seconds: number;
	timezone: string;
	alert_on_late: boolean;
	is_enabled: boolean;
}

/** A rejected submit: what was typed, and the translated issues the form shows beside it. */
export interface CronJobFormState {
	values: CronJobFormValues;
	issues: readonly Form.Issue[];
}

/** The values a new monitor starts from: UTC, five minutes of grace, enabled. */
export const NEW_CRON_JOB_VALUES: CronJobFormValues = {
	name: "",
	description: "",
	cron_expression: "",
	grace_period_seconds: 300,
	timezone: DEFAULT_TIMEZONE,
	alert_on_late: false,
	is_enabled: true,
};

namespace CronJobForm {
	export interface Props {
		/** Where the form posts: the create or the update action. */
		action: string;
		values: CronJobFormValues;
		/** Translated issues from a rejected submit; a field's issue names it in `path`. */
		issues?: readonly Form.Issue[];
		/** Which page renders the form, selecting the `page.<page>.form.*` copy. */
		page: "createCronJob" | "editCronJob";
		intl: ReturnType<typeof getContext>["intl"];
		/** Hidden inputs the action needs beside the fields, such as the monitor's id. */
		hidden?: RemixNode;
		/** The last section's buttons: Cancel and Save, or Create. */
		footer: RemixNode;
	}
}

/**
 * Renders the three sections (basics, schedule, alerting) inside one `<form>`, so a submit
 * posts every field in one request. The timezone select also offers a stored zone the runtime
 * no longer lists, so saving an old monitor never switches its zone.
 */
export default function CronJobForm(handle: Handle<CronJobForm.Props>) {
	return () => {
		let { action, values, issues = [], page, intl, hidden, footer } = handle.props;
		let t = withPrefix(intl.t, `page.${page}.form`);
		let timezoneIssue = issues.find((issue) => issue.path?.[0] === "timezone");

		return (
			<Form method="post" action={action} issues={issues} mix={[vstack({ gap: 12 })]}>
				{hidden}

				<SettingsSection
					id="basics"
					title={t("sections.basics.title")}
					description={t("sections.basics.description")}
				>
					<SettingsSection.Card>
						<SettingsSection.Body>
							<TextField
								label={t("fields.name.label")}
								type="text"
								name="name"
								required
								defaultValue={values.name}
								placeholder={t("fields.name.placeholder")}
								description={t("fields.name.description")}
							/>

							<TextField
								label={t("fields.description.label")}
								type="text"
								name="description"
								defaultValue={values.description}
								placeholder={t("fields.description.placeholder")}
								description={t("fields.description.description")}
							/>
						</SettingsSection.Body>
					</SettingsSection.Card>
				</SettingsSection>

				<SettingsSection
					id="schedule"
					title={t("sections.schedule.title")}
					description={t("sections.schedule.description")}
				>
					<SettingsSection.Card>
						<SettingsSection.Body>
							<TextField
								label={t("fields.cronExpression.label")}
								type="text"
								name="cron_expression"
								required
								defaultValue={values.cron_expression}
								placeholder={t("fields.cronExpression.placeholder")}
								description={t("fields.cronExpression.description")}
							/>

							<StepperField
								id={GRACE_PERIOD_INPUT_ID}
								name="grace_period_seconds"
								label={`${t("fields.gracePeriod.label")} (${t("fields.gracePeriod.unit.seconds")})`}
								decrementLabel={t("fields.gracePeriod.decrement")}
								incrementLabel={t("fields.gracePeriod.increment")}
								min={60}
								max={86_400}
								defaultValue={values.grace_period_seconds}
							/>

							<Field
								label={t("fields.timezone.label")}
								description={t("fields.timezone.description")}
								error={timezoneIssue?.message}
							>
								<Select name="timezone" required>
									{!isSupportedTimeZone(values.timezone) && (
										<Select.Option value={values.timezone} selected>
											{values.timezone}
										</Select.Option>
									)}
									<Select.Option
										value={DEFAULT_TIMEZONE}
										selected={values.timezone === DEFAULT_TIMEZONE}
									>
										{DEFAULT_TIMEZONE}
									</Select.Option>
									{timeZonesByRegion().map((group) => (
										<Select.Group key={group.region} label={group.region}>
											{group.zones.map((zone) => (
												<Select.Option key={zone} value={zone} selected={zone === values.timezone}>
													{zone}
												</Select.Option>
											))}
										</Select.Group>
									))}
								</Select>
							</Field>
						</SettingsSection.Body>
					</SettingsSection.Card>
				</SettingsSection>

				<SettingsSection
					id="alerting"
					title={t("sections.alerting.title")}
					description={t("sections.alerting.description")}
				>
					<SettingsSection.Card>
						<SettingsSection.Body>
							<div mix={[vstack({ gap: SETTINGS_SWITCH_GAP })]}>
								<Switch name="alert_on_late" value="true" defaultChecked={values.alert_on_late}>
									{t("fields.alertOnLate.label")}
								</Switch>

								<Switch name="is_enabled" value="true" defaultChecked={values.is_enabled}>
									{t("fields.enabled.label")}
								</Switch>
							</div>
						</SettingsSection.Body>
						<SettingsSection.Footer>{footer}</SettingsSection.Footer>
					</SettingsSection.Card>
				</SettingsSection>
			</Form>
		);
	};
}
