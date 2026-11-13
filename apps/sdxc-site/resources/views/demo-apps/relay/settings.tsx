/**
 * Relay's settings: how new conversations are assigned, the auto-reply outside office
 * hours, and the signature under every reply. Typed fields save with an explicit button and
 * the auto-reply switch saves the moment it flips, never both in one section.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { vstack } from "@sdxc/u/layout";
import { Select, Switch, TextArea } from "@sdxc/ui";
import { PageHeader } from "@sdxc/ui/app/page-header";
import { SettingsLayout } from "@sdxc/ui/app/settings-layout";
import { SettingsSection } from "@sdxc/ui/app/settings-section";

import { SETTINGS_LABELS } from "~/resources/views/demo-apps/relay/labels";
import { actionHref, href } from "~/resources/views/demo-apps/relay/views";

/** The settings pages, by the path after `settings/`. */
export const SETTINGS_PAGES = ["assignment", "signature"] as const;

/** One settings page. */
export type SettingsPage = (typeof SETTINGS_PAGES)[number];

namespace SettingsScreen {
	export interface Props {
		/** The section shown; `null` is the settings index, which shows assignment beside the nav. */
		page: SettingsPage | null;
	}
}

/** Assignment rules, saved together, and the auto-reply switch, saved on its own. */
function AssignmentSettings() {
	return () => (
		<div mix={[vstack({ gap: 8, align: "stretch" })]}>
			<SettingsSection
				title="Assignment rules"
				description="Who owns a conversation when it arrives."
				save="explicit"
				form={{
					action: actionHref("settings/assignment"),
					fields: <input type="hidden" name="section" value="rules" />,
				}}
				labels={{ save: "Save rules" }}
			>
				<SettingsSection.Row
					label="Assign new conversations"
					description="Round robin skips teammates at their limit."
					htmlFor="relay-settings-strategy"
				>
					<Select id="relay-settings-strategy" name="strategy">
						<Select.Option value="round-robin" selected>
							Round robin
						</Select.Option>
						<Select.Option value="least-busy">To the least busy teammate</Select.Option>
						<Select.Option value="manual">Leave unassigned</Select.Option>
					</Select>
				</SettingsSection.Row>
				<SettingsSection.Row
					label="Reassign when idle for"
					description="A conversation nobody answered moves to the next teammate."
					htmlFor="relay-settings-reassign"
				>
					<Select id="relay-settings-reassign" name="reassignAfter">
						<Select.Option value="never">Never</Select.Option>
						<Select.Option value="4h" selected>
							4 hours
						</Select.Option>
						<Select.Option value="1d">1 day</Select.Option>
					</Select>
				</SettingsSection.Row>
				<SettingsSection.Row
					layout="inline-switch"
					label="Skip teammates who are away"
					description="Away is set from each person's status."
					labelId="relay-settings-skip"
					descriptionId="relay-settings-skip-help"
				>
					<Switch
						name="skipAway"
						aria-labelledby="relay-settings-skip"
						aria-describedby="relay-settings-skip-help"
						checked
					/>
				</SettingsSection.Row>
			</SettingsSection>
			<SettingsSection
				title="Office hours"
				description="Each change saves as soon as you flip it."
				save="instant"
				form={{
					action: actionHref("settings/assignment"),
					fields: <input type="hidden" name="section" value="auto-reply" />,
				}}
				labels={{ save: "Save office hours" }}
			>
				<SettingsSection.Row
					layout="inline-switch"
					label="Auto-reply outside office hours"
					description="Tells customers when to expect an answer. Office hours are 9:00–18:00, Monday to Friday."
					labelId="relay-settings-auto-reply"
					descriptionId="relay-settings-auto-reply-help"
				>
					<Switch
						name="autoReply"
						aria-labelledby="relay-settings-auto-reply"
						aria-describedby="relay-settings-auto-reply-help"
						checked
					/>
				</SettingsSection.Row>
			</SettingsSection>
		</div>
	);
}

/** The signature under every reply, and whether replies carry it. */
function SignatureSettings() {
	return () => (
		<SettingsSection
			title="Signature"
			description="Added under every reply you send."
			save="explicit"
			form={{
				action: actionHref("settings/signature"),
				fields: <input type="hidden" name="section" value="signature" />,
			}}
			labels={{ save: "Save signature" }}
		>
			<SettingsSection.Row label="Signature" htmlFor="relay-settings-signature" layout="stacked">
				<TextArea
					id="relay-settings-signature"
					name="signature"
					rows={4}
					defaultValue={"Noor Haddad\nCustomer support, Fernway\nfernway.app/help"}
				/>
			</SettingsSection.Row>
			<SettingsSection.Row
				layout="inline-switch"
				label="Add to replies"
				description="Internal notes never carry it."
				labelId="relay-settings-signature-on"
				descriptionId="relay-settings-signature-on-help"
			>
				<Switch
					name="includeSignature"
					aria-labelledby="relay-settings-signature-on"
					aria-describedby="relay-settings-signature-on-help"
					checked
				/>
			</SettingsSection.Row>
		</SettingsSection>
	);
}

/** Renders a settings page: the section nav beside the section, or the nav alone on a phone. */
export function SettingsScreen(handle: Handle<SettingsScreen.Props>) {
	return () => {
		let { page } = handle.props;
		let shown = page ?? "assignment";

		return (
			<div mix={[vstack({ gap: 6, align: "stretch" })]}>
				<PageHeader title="Settings" description="For everyone on Fernway's support team." />
				<SettingsLayout
					sections={[
						{
							label: "Inbox",
							items: [
								{
									href: href("settings/assignment"),
									label: "Assignment",
									current: shown === "assignment",
								},
								{
									href: href("settings/signature"),
									label: "Signature",
									current: shown === "signature",
								},
							],
						},
					]}
					page={page === null ? "index" : "section"}
					backHref={href("settings")}
					labels={SETTINGS_LABELS}
				>
					{shown === "signature" ? <SignatureSettings /> : <AssignmentSettings />}
				</SettingsLayout>
			</div>
		);
	};
}
