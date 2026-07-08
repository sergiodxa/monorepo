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

import type { Handle } from "remix/ui";

import type { SelectAlert, SelectMonitor } from "~/database/schema";

import * as s from "~/resources/styles";

namespace AlertFormFields {
	export interface Props {
		/** HTTP monitors available for monitor-specific targeting. */
		monitors: SelectMonitor[];
		/** Existing alert values when editing; omitted when creating. */
		alert?: SelectAlert;
	}
}

export default function AlertFormFields(handle: Handle<AlertFormFields.Props>) {
	return () => {
		let { monitors, alert } = handle.props;
		let config = alert?.config;

		return (
			<>
				<label mix={[s.field]}>
					<span>Name</span>
					<input type="text" name="name" required defaultValue={alert?.name} mix={[s.input]} />
				</label>

				<label mix={[s.field]}>
					<span>Scope</span>
					<select name="monitor_id" defaultValue={alert?.monitor_id ?? ""} mix={[s.selectInput]}>
						<option value="">Team-wide (every monitor)</option>
						{monitors.map((monitor) => (
							<option key={monitor.id} value={monitor.id}>
								{monitor.name} (HTTP)
							</option>
						))}
					</select>
				</label>

				<label mix={[s.field]}>
					<span>Channel</span>
					<select name="strategy" defaultValue={config?.strategy ?? "email"} mix={[s.selectInput]}>
						<option value="email">Email</option>
						<option value="webhook">Webhook</option>
						<option value="slack">Slack</option>
						<option value="discord">Discord</option>
					</select>
				</label>

				<fieldset>
					<legend>Email settings</legend>
					<label mix={[s.field]}>
						<span>Recipient</span>
						<input
							type="email"
							name="email_to"
							defaultValue={config?.strategy === "email" ? config.config.to : ""}
							mix={[s.input]}
						/>
					</label>
					<label mix={[s.field]}>
						<span>Subject prefix (optional)</span>
						<input
							type="text"
							name="email_subject_prefix"
							defaultValue={config?.strategy === "email" ? config.config.subjectPrefix : ""}
							mix={[s.input]}
						/>
					</label>
				</fieldset>

				<fieldset>
					<legend>Webhook settings</legend>
					<label mix={[s.field]}>
						<span>URL</span>
						<input
							type="url"
							name="webhook_url"
							defaultValue={config?.strategy === "webhook" ? config.config.url : ""}
							mix={[s.input]}
						/>
					</label>
					<label mix={[s.field]}>
						<span>Signing secret (optional)</span>
						<input
							type="text"
							name="webhook_secret"
							defaultValue={config?.strategy === "webhook" ? config.config.secret : ""}
							mix={[s.input]}
						/>
					</label>
					<p mix={[s.mutedSmall]}>
						When set, requests carry a <code>Webhook-Signature: sha256=&lt;hex&gt;</code> header —
						an HMAC-SHA256 of the raw JSON body using this secret.
					</p>
				</fieldset>

				<fieldset>
					<legend>Slack settings</legend>
					<label mix={[s.field]}>
						<span>Webhook URL</span>
						<input
							type="url"
							name="slack_webhook_url"
							defaultValue={config?.strategy === "slack" ? config.config.webhookUrl : ""}
							mix={[s.input]}
						/>
					</label>
					<label mix={[s.field]}>
						<span>Channel override (optional)</span>
						<input
							type="text"
							name="slack_channel"
							defaultValue={config?.strategy === "slack" ? (config.config.channel ?? "") : ""}
							placeholder="#incidents"
							mix={[s.input]}
						/>
					</label>
				</fieldset>

				<fieldset>
					<legend>Discord settings</legend>
					<label mix={[s.field]}>
						<span>Webhook URL</span>
						<input
							type="url"
							name="discord_webhook_url"
							defaultValue={config?.strategy === "discord" ? config.config.webhookUrl : ""}
							mix={[s.input]}
						/>
					</label>
				</fieldset>

				<label mix={[s.checkboxField]}>
					<input
						type="checkbox"
						name="notify_on_recovery"
						value="true"
						defaultChecked={alert?.notify_on_recovery ?? true}
					/>
					<span>Notify on recovery</span>
				</label>

				<label mix={[s.field]}>
					<span>Cooldown (minutes, 0 = no cooldown)</span>
					<input
						type="number"
						name="cooldown_minutes"
						min={0}
						max={1440}
						defaultValue={alert?.cooldown_minutes ?? 0}
						mix={[s.input]}
					/>
				</label>
			</>
		);
	};
}
