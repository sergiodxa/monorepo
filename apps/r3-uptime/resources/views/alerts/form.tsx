/**
 * Shared alert form fields, used by both the new-alert and edit-alert views. All four
 * channel fieldsets render together; the server only requires the fields for the
 * selected channel (see `app/http/validators/alert.ts`). Only HTTP monitors can be
 * individually targeted — the `alerts` table has no `monitor_type` column, so scoping
 * to a DNS/TCP/cron-job monitor could never be resolved back to the right table.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CSSMixinDescriptor, ElementProps, Handle, MixinDescriptor } from "remix/ui";

import { css } from "remix/ui";

import type { SelectAlert, SelectMonitor } from "~/database/schema";

import Field from "~/resources/components/field";
import { neutral } from "~/resources/theme";

/**
 * Re-types a `css()` mixin for `<select>`. `css()`'s return type doesn't directly fit
 * `HTMLSelectElement` due to a Cloudflare Workers types conflict; only the compile-time
 * type changes, the runtime value is identical.
 */
function mixForSelect(
	mixin: CSSMixinDescriptor,
): MixinDescriptor<HTMLSelectElement, CSSMixinDescriptor["args"], ElementProps> {
	return mixin as unknown as MixinDescriptor<
		HTMLSelectElement,
		CSSMixinDescriptor["args"],
		ElementProps
	>;
}

namespace AlertFormFields {
	export interface Props {
		/** HTTP monitors available for monitor-specific targeting. */
		monitors: SelectMonitor[];
		/** Existing alert values when editing; omitted when creating. */
		alert?: SelectAlert;
	}
}

/** Renders the name/scope/channel fields plus all four channel-specific fieldsets, pre-filled from `alert` when editing. */
export default function AlertFormFields(handle: Handle<AlertFormFields.Props>) {
	return () => {
		let { monitors, alert } = handle.props;
		let config = alert?.config;

		return (
			<>
				<Field label="Name">
					<input
						type="text"
						name="name"
						required
						defaultValue={alert?.name}
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
						defaultValue={alert?.monitor_id ?? ""}
						mix={[
							mixForSelect(
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
							),
						]}
					>
						<option value="">Team-wide (every monitor)</option>
						{monitors.map((monitor) => (
							<option key={monitor.id} value={monitor.id}>
								{monitor.name} (HTTP)
							</option>
						))}
					</select>
				</Field>

				<Field label="Channel">
					<select
						name="strategy"
						defaultValue={config?.strategy ?? "email"}
						mix={[
							mixForSelect(
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
							),
						]}
					>
						<option value="email">Email</option>
						<option value="webhook">Webhook</option>
						<option value="slack">Slack</option>
						<option value="discord">Discord</option>
					</select>
				</Field>

				<fieldset>
					<legend>Email settings</legend>
					<Field label="Recipient">
						<input
							type="email"
							name="email_to"
							defaultValue={config?.strategy === "email" ? config.config.to : ""}
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
					<Field label="Subject prefix (optional)">
						<input
							type="text"
							name="email_subject_prefix"
							defaultValue={config?.strategy === "email" ? config.config.subjectPrefix : ""}
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
				</fieldset>

				<fieldset>
					<legend>Webhook settings</legend>
					<Field label="URL">
						<input
							type="url"
							name="webhook_url"
							defaultValue={config?.strategy === "webhook" ? config.config.url : ""}
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
					<Field label="Signing secret (optional)">
						<input
							type="text"
							name="webhook_secret"
							defaultValue={config?.strategy === "webhook" ? config.config.secret : ""}
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
					<p
						mix={[
							css({
								fontSize: "0.8125rem",
								color: neutral[500],
								"@media (prefers-color-scheme: dark)": { color: neutral[400] },
							}),
						]}
					>
						When set, requests carry a <code>Webhook-Signature: sha256=&lt;hex&gt;</code> header —
						an HMAC-SHA256 of the raw JSON body using this secret.
					</p>
				</fieldset>

				<fieldset>
					<legend>Slack settings</legend>
					<Field label="Webhook URL">
						<input
							type="url"
							name="slack_webhook_url"
							defaultValue={config?.strategy === "slack" ? config.config.webhookUrl : ""}
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
					<Field label="Channel override (optional)">
						<input
							type="text"
							name="slack_channel"
							defaultValue={config?.strategy === "slack" ? (config.config.channel ?? "") : ""}
							placeholder="#incidents"
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
				</fieldset>

				<fieldset>
					<legend>Discord settings</legend>
					<Field label="Webhook URL">
						<input
							type="url"
							name="discord_webhook_url"
							defaultValue={config?.strategy === "discord" ? config.config.webhookUrl : ""}
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
				</fieldset>

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
						name="notify_on_recovery"
						value="true"
						defaultChecked={alert?.notify_on_recovery ?? true}
					/>
					<span>Notify on recovery</span>
				</label>

				<Field label="Cooldown (minutes, 0 = no cooldown)">
					<input
						type="number"
						name="cooldown_minutes"
						min={0}
						max={1440}
						defaultValue={alert?.cooldown_minutes ?? 0}
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
			</>
		);
	};
}
