/**
 * Pulse's settings, shown in the swapped settings panel: General with an explicit Save and
 * the danger zone last, Notifications with switches that save as they flip beside an explicit
 * escalation form, and Billing behind the owner-only permission state.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { LockIcon } from "@sdxc/icons";
import { vstack } from "@sdxc/u/layout";
import { minIs } from "@sdxc/u/size";
import { Group, HeadingScope, Input, Select, Switch } from "@sdxc/ui";
import { DangerZone } from "@sdxc/ui/app/danger-zone";
import { Empty } from "@sdxc/ui/app/empty";
import { PageHeader } from "@sdxc/ui/app/page-header";
import { SettingsLayout } from "@sdxc/ui/app/settings-layout";
import { SettingsSection } from "@sdxc/ui/app/settings-section";

import type { DemoAppRequest } from "~/resources/views/demo-apps";

import type { PulseSettingsSection } from "./shell";

import { actionHref, href } from "./data";
import { COPY, SETTINGS_LABELS } from "./labels";

/** The workspace slug the delete confirmation asks the visitor to type. */
export const WORKSPACE_SLUG = "northwind";

/** The time zones the general section offers. */
const TIME_ZONES = ["UTC", "Europe/Berlin", "America/New_York", "Asia/Singapore"] as const;

/** The general section: the workspace form with its own Save, then the danger zone. */
function General() {
	return () => {
		let copy = COPY.settings.general;
		return (
			<div mix={[vstack({ gap: 8, align: "stretch" }), minIs(0)]}>
				<SettingsSection
					title={copy.section}
					description={copy.sectionDescription}
					save="explicit"
					form={{ action: actionHref("settings") }}
					labels={{ save: copy.save }}
				>
					<SettingsSection.Row label={copy.name} htmlFor="pulse-settings-name">
						<Input id="pulse-settings-name" name="name" defaultValue={COPY.workspace} required />
					</SettingsSection.Row>
					<SettingsSection.Row
						label={copy.slug}
						description={copy.slugHint}
						htmlFor="pulse-settings-slug"
					>
						<Group>
							<Group.Text id="pulse-settings-slug-prefix" htmlFor="pulse-settings-slug">
								{copy.slugPrefix}
							</Group.Text>
							<Input
								id="pulse-settings-slug"
								name="slug"
								defaultValue={WORKSPACE_SLUG}
								aria-label={copy.slug}
								aria-describedby="pulse-settings-slug-prefix"
								required
							/>
						</Group>
					</SettingsSection.Row>
					<SettingsSection.Row label={copy.timezone} htmlFor="pulse-settings-timezone">
						<Select id="pulse-settings-timezone" name="timezone">
							{TIME_ZONES.map((zone) => (
								<Select.Option key={zone} value={zone} selected={zone === "Europe/Berlin"}>
									{zone}
								</Select.Option>
							))}
						</Select>
					</SettingsSection.Row>
				</SettingsSection>
				<DangerZone title={copy.danger}>
					<DangerZone.Action
						id="pulse-settings-transfer"
						title={copy.transferTitle}
						description={copy.transferDescription}
						buttonLabel={copy.transferButton}
						confirm={{
							title: copy.transferConfirmTitle,
							description: copy.transferConfirmBody,
							confirmLabel: copy.transferConfirm,
							cancelLabel: copy.cancel,
							form: { action: actionHref("settings/transfer") },
						}}
					/>
					<DangerZone.Action
						id="pulse-settings-delete"
						title={copy.deleteTitle}
						description={copy.deleteDescription}
						consequences={[...copy.deleteConsequences]}
						buttonLabel={copy.deleteButton}
						confirm={{
							title: copy.deleteConfirmTitle,
							description: copy.deleteConfirmBody,
							confirmLabel: copy.deleteConfirm,
							cancelLabel: copy.cancel,
							typeToConfirm: {
								value: WORKSPACE_SLUG,
								label: copy.deleteType,
								name: "confirmation",
							},
							form: { action: actionHref("settings/delete") },
						}}
					/>
				</DangerZone>
			</div>
		);
	};
}

/** The notifications section: instant switches, then the explicit escalation form. */
function Notifications() {
	return () => {
		let copy = COPY.settings.notifications;
		return (
			<div mix={[vstack({ gap: 8, align: "stretch" }), minIs(0)]}>
				<SettingsSection
					title={copy.instant}
					description={copy.instantDescription}
					save="instant"
					form={{ action: actionHref("settings/notifications") }}
					labels={{ save: copy.saveSwitches }}
				>
					<SettingsSection.Row layout="inline-switch" label={copy.down} labelId="pulse-alert-down">
						<Switch name="pageOnDown" aria-labelledby="pulse-alert-down" checked />
					</SettingsSection.Row>
					<SettingsSection.Row
						layout="inline-switch"
						label={copy.degraded}
						labelId="pulse-alert-degraded"
					>
						<Switch name="postOnDegraded" aria-labelledby="pulse-alert-degraded" checked />
					</SettingsSection.Row>
					<SettingsSection.Row
						layout="inline-switch"
						label={copy.deploys}
						labelId="pulse-alert-deploys"
					>
						<Switch name="postDeploys" aria-labelledby="pulse-alert-deploys" />
					</SettingsSection.Row>
					<SettingsSection.Row
						layout="inline-switch"
						label={copy.weekly}
						description={copy.weeklyHint}
						labelId="pulse-alert-weekly"
						descriptionId="pulse-alert-weekly-hint"
					>
						<Switch
							name="weeklyReport"
							aria-labelledby="pulse-alert-weekly"
							aria-describedby="pulse-alert-weekly-hint"
							checked
						/>
					</SettingsSection.Row>
				</SettingsSection>
				<SettingsSection
					title={copy.escalation}
					description={copy.escalationDescription}
					save="explicit"
					form={{ action: actionHref("settings/escalation") }}
					labels={{ save: copy.save }}
				>
					<SettingsSection.Row label={copy.email} htmlFor="pulse-escalation-email">
						<Input
							id="pulse-escalation-email"
							name="email"
							type="email"
							defaultValue="oncall@northwind.dev"
							required
						/>
					</SettingsSection.Row>
					<SettingsSection.Row label={copy.after} htmlFor="pulse-escalation-after">
						<Select id="pulse-escalation-after" name="after">
							{Object.entries(copy.afterOptions).map(([value, label]) => (
								<Select.Option key={value} value={value} selected={value === "15"}>
									{label}
								</Select.Option>
							))}
						</Select>
					</SettingsSection.Row>
				</SettingsSection>
			</div>
		);
	};
}

/** The billing section, which only owners may see: a permission state naming who can help. */
function Billing() {
	return () => (
		<Empty kind="permission" size="compact" icon={<LockIcon />}>
			<Empty.Title>{COPY.settings.billing.permission}</Empty.Title>
			<Empty.Description>{COPY.settings.billing.permissionHint}</Empty.Description>
		</Empty>
	);
}

namespace Settings {
	export interface Props {
		request: DemoAppRequest;
		section: PulseSettingsSection;
	}
}

/** A settings screen's content, under the frame's settings panel. */
export default function Settings(handle: Handle<Settings.Props>) {
	return () => {
		let { section } = handle.props;
		let copy = COPY.settings[section];
		return (
			<div mix={[vstack({ gap: 5, align: "stretch" }), minIs(0)]}>
				<PageHeader title={copy.title} description={copy.description} />
				<SettingsLayout backHref={href("settings")} labels={SETTINGS_LABELS}>
					<HeadingScope level={2}>
						{section === "general" ? <General /> : null}
						{section === "notifications" ? <Notifications /> : null}
						{section === "billing" ? <Billing /> : null}
					</HeadingScope>
				</SettingsLayout>
			</div>
		);
	};
}
