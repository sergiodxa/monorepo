/**
 * Shared alert form fields, used by both the new-alert and edit-alert views. All four
 * channel fieldsets render together; the server only requires the fields for the
 * selected channel (see `app/http/validators/alert.ts`). Only HTTP monitors can be
 * individually targeted — the `alerts` table has no `monitor_type` column, so scoping
 * to a DNS/TCP/cron-job monitor could never be resolved back to the right table.
 *
 * Reads its copy from `page.alerts.form.fields.*`, shared by the create and edit
 * pages alike — unlike `resources/views/monitors/form.tsx`'s per-page namespace,
 * there's only ever one alert form layout to describe.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { getContext } from "remix/async-context-middleware";
import type { Handle } from "remix/ui";

import { fg } from "@pkg/u/color";
import { mbe } from "@pkg/u/size";
import { fontSize } from "@pkg/u/typography";
import { Input, Select, Switch, TextField } from "@pkg/ui";

import type { SelectAlert, SelectMonitor } from "~/database/schema";

import { DEFAULT_COOLDOWN_MINUTES, MIN_REPEAT_COOLDOWN_MINUTES } from "~/app/lib/alert-policy";
import Field from "~/resources/components/field";

namespace AlertFormFields {
	export interface Props {
		/** HTTP monitors available for monitor-specific targeting. */
		monitors: SelectMonitor[];
		/** Existing alert values when editing; omitted when creating. */
		alert?: SelectAlert;
		/** The request's i18next instance, used to read this form's `page.alerts.form.fields.*` copy. */
		i18next: ReturnType<typeof getContext>["i18next"];
	}
}

/** Splits a translated string containing exactly one `<code>...</code>` span into plain text plus a `<code>` node. */
function renderInlineCode(text: string) {
	let match = /^(.*)<code>(.*)<\/code>(.*)$/s.exec(text);
	if (!match) return text;
	let [, before, code, after] = match;
	return (
		<>
			{before}
			<code>{code}</code>
			{after}
		</>
	);
}

/** Renders the name/scope/channel fields plus all four channel-specific fieldsets, pre-filled from `alert` when editing. */
export default function AlertFormFields(handle: Handle<AlertFormFields.Props>) {
	return () => {
		let { monitors, alert, i18next } = handle.props;
		let t = i18next.getFixedT(null, "translation", "page.alerts.form.fields");
		let config = alert?.config;

		return (
			<>
				<TextField
					label={t("name.label")}
					name="name"
					required
					defaultValue={alert?.name}
					mix={[mbe("28px")]}
				/>

				<Field label={t("scope.label")}>
					<Select name="monitor_id" defaultValue={alert?.monitor_id ?? ""}>
						<Select.Option value="">{t("scope.teamWide")}</Select.Option>
						{monitors.map((monitor) => (
							<Select.Option key={monitor.id} value={monitor.id}>
								{monitor.name} (HTTP)
							</Select.Option>
						))}
					</Select>
				</Field>

				<Field label={t("channel.label")}>
					<Select name="strategy" defaultValue={config?.strategy ?? "email"}>
						<Select.Option value="email">{t("channel.options.email")}</Select.Option>
						<Select.Option value="webhook">{t("channel.options.webhook")}</Select.Option>
						<Select.Option value="slack">{t("channel.options.slack")}</Select.Option>
						<Select.Option value="discord">{t("channel.options.discord")}</Select.Option>
					</Select>
				</Field>

				<fieldset mix={[mbe("28px")]}>
					<legend>{t("legends.email")}</legend>
					<TextField
						label={t("config.email.to.label")}
						type="email"
						name="email_to"
						defaultValue={config?.strategy === "email" ? config.config.to : ""}
						mix={[mbe("28px")]}
					/>
					<TextField
						label={t("config.email.subjectPrefix.label")}
						name="email_subject_prefix"
						defaultValue={config?.strategy === "email" ? config.config.subjectPrefix : ""}
					/>
				</fieldset>

				<fieldset mix={[mbe("28px")]}>
					<legend>{t("legends.webhook")}</legend>
					<TextField
						label={t("config.webhook.url.label")}
						type="url"
						name="webhook_url"
						defaultValue={config?.strategy === "webhook" ? config.config.url : ""}
						mix={[mbe("28px")]}
					/>
					<TextField
						label={t("config.webhook.secret.label")}
						name="webhook_secret"
						defaultValue={config?.strategy === "webhook" ? config.config.secret : ""}
						mix={[mbe("28px")]}
					/>
					<p mix={[fontSize("0.8125rem"), fg("neutral.muted")]}>
						{renderInlineCode(t("config.webhook.signatureNote"))}
					</p>
				</fieldset>

				<fieldset mix={[mbe("28px")]}>
					<legend>{t("legends.slack")}</legend>
					<TextField
						label={t("config.slack.webhookUrl.label")}
						type="url"
						name="slack_webhook_url"
						defaultValue={config?.strategy === "slack" ? config.config.webhookUrl : ""}
						mix={[mbe("28px")]}
					/>
					<TextField
						label={t("config.slack.channel.label")}
						name="slack_channel"
						placeholder="#incidents"
						defaultValue={config?.strategy === "slack" ? (config.config.channel ?? "") : ""}
					/>
				</fieldset>

				<fieldset mix={[mbe("28px")]}>
					<legend>{t("legends.discord")}</legend>
					<TextField
						label={t("config.discord.webhookUrl.label")}
						type="url"
						name="discord_webhook_url"
						defaultValue={config?.strategy === "discord" ? config.config.webhookUrl : ""}
					/>
				</fieldset>

				<Switch
					name="notify_on_recovery"
					value="true"
					defaultChecked={alert?.notify_on_recovery ?? true}
				>
					{t("notifyOnRecovery.label")}
				</Switch>

				<Field
					label={t("cooldownMinutes.label")}
					description={t("cooldownMinutes.description", {
						floor: MIN_REPEAT_COOLDOWN_MINUTES,
					})}
				>
					<Input
						type="number"
						name="cooldown_minutes"
						/**
						 * `min` stays 0 even though a repeat is never spaced closer than
						 * {@link MIN_REPEAT_COOLDOWN_MINUTES}. Raising it would make every alert already
						 * storing a smaller value unsaveable — the field is prefilled from the row, so
						 * the form would refuse to submit until somebody noticed why. The floor is
						 * enforced at dispatch, where it reaches stored rows too, and the description
						 * says so.
						 */
						min={0}
						max={1440}
						defaultValue={alert?.cooldown_minutes ?? DEFAULT_COOLDOWN_MINUTES}
					/>
				</Field>
			</>
		);
	};
}
