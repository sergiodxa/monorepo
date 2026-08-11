/**
 * The "Notification channel" card's contents: the channel `<select>` and the four
 * per-channel settings fieldsets it chooses between. Both the create and the edit alert
 * pages render exactly this block — the only thing that differs between them is whether
 * the fields start empty or prefilled — so it lives here instead of being spelled out
 * twice.
 *
 * Only the selected channel's fieldset is shown, and the switching is done in CSS alone:
 * a `<select>`'s currently selected `<option>` matches `:checked` and keeps matching as
 * the user changes the selection, so `:has()` can read the choice from an ancestor and
 * hide the fieldsets that don't belong to it. That keeps the page working with
 * JavaScript disabled, which a client island would not. The rules are written as "hide
 * this channel when something *else* is selected" rather than "hide everything, then
 * show one", so no two rules ever compete over the same fieldset — and so a browser
 * without `:has()` simply falls back to showing all four, which is still a complete,
 * submittable form rather than an empty card.
 *
 * Hiding is `display: none`, so every channel's inputs stay in the DOM and still post
 * their (empty, for the channels nobody filled in) values. That is what the server
 * expects: the create/update schemas mark all of them optional and only require the
 * selected `strategy`'s fields, and the action builds the stored config from that
 * strategy alone, ignoring the rest.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { getContext } from "remix/async-context-middleware";
import type { Handle } from "remix/ui";

import { fg } from "@pkg/u/color";
import { hidden } from "@pkg/u/layout";
import { mbe } from "@pkg/u/size";
import { has, when } from "@pkg/u/state";
import { fontSize } from "@pkg/u/typography";
import { Select, TextField } from "@pkg/ui";

import type { AlertConfig } from "~/database/schema";

import Field from "~/resources/components/field";

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

		// The create and edit pages label these fields identically, so both read the same
		// shared namespace rather than a per-page one.
		let t = i18next.getFixedT(null, "translation", "page.alerts.form.fields");

		return (
			<div
				mix={CHANNELS.map((channel) =>
					has(
						`select[name="strategy"] option:checked:not([value="${channel}"])`,
						when(`& [data-channel="${channel}"]`, hidden()),
					),
				)}
			>
				<Field label={t("channel.label")}>
					{/*
					 * The saved channel is marked `selected` on its own `<option>` rather than
					 * through a `defaultValue` on the host: `<select>` has no such attribute, so
					 * that spelling reaches the browser as inert markup and leaves the first
					 * option selected — which here would also mean the wrong settings block being
					 * the one revealed.
					 */}
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

				<fieldset data-channel="email" mix={[mbe("28px")]}>
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

				<fieldset data-channel="webhook" mix={[mbe("28px")]}>
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

				<fieldset data-channel="slack" mix={[mbe("28px")]}>
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

				<fieldset data-channel="discord" mix={[mbe("28px")]}>
					<legend>{t("legends.discord")}</legend>
					<TextField
						label={t("config.discord.webhookUrl.label")}
						type="url"
						name="discord_webhook_url"
						defaultValue={config?.strategy === "discord" ? config.config.webhookUrl : ""}
					/>
				</fieldset>
			</div>
		);
	};
}
