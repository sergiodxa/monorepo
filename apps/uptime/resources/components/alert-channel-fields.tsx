/**
 * The channel `<select>` and its four per-channel fieldsets, shared by the
 * create and edit alert pages. `:has()` on the checked option shows only
 * the chosen fieldset in CSS alone, so the form works without JavaScript,
 * and hidden fieldsets still post their (empty) values for schemas that
 * only require the chosen strategy.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { getContext } from "remix/middleware/async-context";
import type { Handle } from "remix/ui";

import { fg } from "@pkg/u/color";
import { hidden, vstack } from "@pkg/u/layout";
import { m } from "@pkg/u/size";
import { has, when } from "@pkg/u/state";
import { fontSize } from "@pkg/u/typography";
import { Select, TextField } from "@pkg/ui";

import type { AlertConfig } from "~/database/schema";

import Field from "~/resources/components/field";
import { SETTINGS_FIELD_GAP } from "~/resources/components/settings-section";

const CHANNELS = ["email", "webhook", "slack", "discord"] as const;

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

namespace AlertChannelFields {
	export interface Props {
		/** The alert's saved channel config when editing; omitted when creating. */
		config?: AlertConfig | null;
		/** The request's i18next instance, used to read the shared `page.alerts.form.fields.*` copy. */
		i18next: ReturnType<typeof getContext>["i18next"];
	}
}

/** Renders the channel picker plus every channel's settings, revealing only the selected one. */
export default function AlertChannelFields(handle: Handle<AlertChannelFields.Props>) {
	return () => {
		let { config, i18next } = handle.props;

		/**
		 * Reads the shared `page.alerts.form.fields` namespace so the create
		 * and edit pages label these fields identically.
		 */
		let t = i18next.getFixedT(null, "translation", "page.alerts.form.fields");

		/**
		 * The saved channel's own `<option>` is marked `selected`, which is
		 * what determines a `<select>`'s initial choice and keeps that
		 * channel's fieldset the one revealed.
		 */
		return (
			<div
				mix={[
					/**
					 * A hidden flex item produces no gap, so the four fieldsets stacking on
					 * the same rhythm as the picker above them cost nothing while three
					 * stay `display: none` — the usual case, since only one channel shows.
					 */
					vstack({ gap: SETTINGS_FIELD_GAP }),
					...CHANNELS.map((channel) =>
						has(
							`select[name="strategy"] option:checked:not([value="${channel}"])`,
							when(`& [data-channel="${channel}"]`, hidden()),
						),
					),
				]}
			>
				<Field label={t("channel.label")}>
					<Select name="strategy">
						{CHANNELS.map((channel) => (
							<Select.Option
								key={channel}
								value={channel}
								selected={channel === (config?.strategy ?? "email")}
							>
								{t(`channel.options.${channel}`)}
							</Select.Option>
						))}
					</Select>
				</Field>

				<fieldset data-channel="email">
					<legend>{t("legends.email")}</legend>
					<div mix={[vstack({ gap: SETTINGS_FIELD_GAP })]}>
						<TextField
							label={t("config.email.to.label")}
							type="email"
							name="email_to"
							defaultValue={config?.strategy === "email" ? config.config.to : ""}
						/>
						<TextField
							label={t("config.email.subjectPrefix.label")}
							name="email_subject_prefix"
							defaultValue={config?.strategy === "email" ? config.config.subjectPrefix : ""}
						/>
					</div>
				</fieldset>

				<fieldset data-channel="webhook">
					<legend>{t("legends.webhook")}</legend>
					<div mix={[vstack({ gap: SETTINGS_FIELD_GAP })]}>
						<TextField
							label={t("config.webhook.url.label")}
							type="url"
							name="webhook_url"
							defaultValue={config?.strategy === "webhook" ? config.config.url : ""}
						/>
						<TextField
							label={t("config.webhook.secret.label")}
							name="webhook_secret"
							defaultValue={config?.strategy === "webhook" ? config.config.secret : ""}
						/>
						<p mix={[m(0), fontSize("0.8125rem"), fg("neutral.muted")]}>
							{renderInlineCode(t("config.webhook.signatureNote"))}
						</p>
					</div>
				</fieldset>

				<fieldset data-channel="slack">
					<legend>{t("legends.slack")}</legend>
					<div mix={[vstack({ gap: SETTINGS_FIELD_GAP })]}>
						<TextField
							label={t("config.slack.webhookUrl.label")}
							type="url"
							name="slack_webhook_url"
							defaultValue={config?.strategy === "slack" ? config.config.webhookUrl : ""}
						/>
						<TextField
							label={t("config.slack.channel.label")}
							name="slack_channel"
							placeholder="#incidents"
							defaultValue={config?.strategy === "slack" ? (config.config.channel ?? "") : ""}
						/>
					</div>
				</fieldset>

				<fieldset data-channel="discord">
					<legend>{t("legends.discord")}</legend>
					<div mix={[vstack({ gap: SETTINGS_FIELD_GAP })]}>
						<TextField
							label={t("config.discord.webhookUrl.label")}
							type="url"
							name="discord_webhook_url"
							defaultValue={config?.strategy === "discord" ? config.config.webhookUrl : ""}
						/>
					</div>
				</fieldset>
			</div>
		);
	};
}
