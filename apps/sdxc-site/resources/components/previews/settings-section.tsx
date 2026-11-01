/**
 * Live preview for `SettingsSection`: an uptime app's monitor defaults, typed inputs that
 * save explicitly from the section's own footer, beside its notifications, switches that
 * save the moment they flip. One section never mixes the two.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { Input, Select, Switch } from "@sdxc/ui";
import { SettingsSection } from "@sdxc/ui/app/settings-section";

/** The source the page shows, matching the markup below apart from element ids. */
const CODE = `<SettingsSection
	title="Monitor defaults"
	description="Applied to every monitor you create from now on."
	save="explicit"
	form={{ action: "/settings/monitors" }}
	labels={{ save: "Save defaults" }}
>
	<SettingsSection.Row label="Check interval" description="How often each URL is requested." htmlFor="interval">
		<Select id="interval" name="interval">
			<Select.Option value="30">Every 30 seconds</Select.Option>
			<Select.Option value="60" selected>Every minute</Select.Option>
			<Select.Option value="300">Every 5 minutes</Select.Option>
		</Select>
	</SettingsSection.Row>
	<SettingsSection.Row label="Timeout" description="A check slower than this counts as down." htmlFor="timeout">
		<Input id="timeout" name="timeoutMs" type="number" defaultValue="10000" />
	</SettingsSection.Row>
	<SettingsSection.Row label="Alert email" htmlFor="alert-email" layout="stacked">
		<Input id="alert-email" name="alertEmail" type="email" defaultValue="oncall@acme.dev" />
	</SettingsSection.Row>
</SettingsSection>

<SettingsSection
	title="Notifications"
	description="Each change saves as soon as you flip it."
	save="instant"
	form={{ action: "/settings/notifications" }}
	labels={{ save: "Save notifications" }}
>
	<SettingsSection.Row layout="inline-switch" label="Email me when a monitor goes down" labelId="down">
		<Switch name="emailOnDown" aria-labelledby="down" checked />
	</SettingsSection.Row>
	<SettingsSection.Row
		layout="inline-switch"
		label="Weekly uptime report"
		description="Sent on Monday at 9:00 in your time zone."
		labelId="weekly"
		descriptionId="weekly-help"
	>
		<Switch name="weeklyReport" aria-labelledby="weekly" aria-describedby="weekly-help" />
	</SettingsSection.Row>
</SettingsSection>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[vstack({ gap: 10, align: "stretch" }), is("100%")]}>
			<SettingsSection
				title="Monitor defaults"
				description="Applied to every monitor you create from now on."
				save="explicit"
				form={{ action: "/examples/settings/monitors" }}
				labels={{ save: "Save defaults" }}
			>
				<SettingsSection.Row
					label="Check interval"
					description="How often each URL is requested."
					htmlFor="preview-settings-interval"
				>
					<Select id="preview-settings-interval" name="interval">
						<Select.Option value="30">Every 30 seconds</Select.Option>
						<Select.Option value="60" selected>
							Every minute
						</Select.Option>
						<Select.Option value="300">Every 5 minutes</Select.Option>
					</Select>
				</SettingsSection.Row>
				<SettingsSection.Row
					label="Timeout"
					description="A check slower than this counts as down."
					htmlFor="preview-settings-timeout"
				>
					<Input
						id="preview-settings-timeout"
						name="timeoutMs"
						type="number"
						defaultValue="10000"
					/>
				</SettingsSection.Row>
				<SettingsSection.Row label="Alert email" htmlFor="preview-settings-email" layout="stacked">
					<Input
						id="preview-settings-email"
						name="alertEmail"
						type="email"
						defaultValue="oncall@acme.dev"
					/>
				</SettingsSection.Row>
			</SettingsSection>

			<SettingsSection
				title="Notifications"
				description="Each change saves as soon as you flip it."
				save="instant"
				form={{ action: "/examples/settings/notifications" }}
				labels={{ save: "Save notifications" }}
			>
				<SettingsSection.Row
					layout="inline-switch"
					label="Email me when a monitor goes down"
					labelId="preview-settings-down"
				>
					<Switch name="emailOnDown" aria-labelledby="preview-settings-down" checked />
				</SettingsSection.Row>
				<SettingsSection.Row
					layout="inline-switch"
					label="Weekly uptime report"
					description="Sent on Monday at 9:00 in your time zone."
					labelId="preview-settings-weekly"
					descriptionId="preview-settings-weekly-help"
				>
					<Switch
						name="weeklyReport"
						aria-labelledby="preview-settings-weekly"
						aria-describedby="preview-settings-weekly-help"
					/>
				</SettingsSection.Row>
			</SettingsSection>
		</div>
	),
};
