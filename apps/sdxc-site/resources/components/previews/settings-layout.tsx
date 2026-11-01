/**
 * Live preview for `SettingsLayout`: an uptime app's settings, with the section nav on the
 * start side and the Monitors section in the content column. Narrow the pane and the nav
 * gives way to the content and a back link, as it does on a phone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is } from "@sdxc/u/size";
import { Input } from "@sdxc/ui";
import { SettingsLayout } from "@sdxc/ui/app/settings-layout";
import { SettingsSection } from "@sdxc/ui/app/settings-section";

/** The settings area's sections, with Monitors as the one being shown. */
const NAV: ReadonlyArray<SettingsLayout.Group> = [
	{
		label: "Workspace",
		items: [
			{ href: "#general", label: "General" },
			{ href: "#monitors", label: "Monitors", current: true },
			{ href: "#status-pages", label: "Status pages" },
			{ href: "#members", label: "Members" },
			{ href: "#billing", label: "Billing" },
		],
	},
	{
		label: "Account",
		items: [
			{ href: "#profile", label: "Profile" },
			{ href: "#notifications", label: "Notifications" },
		],
	},
];

/** The source the page shows, matching the markup below apart from element ids. */
const CODE = `<SettingsLayout
	sections={[
		{
			label: "Workspace",
			items: [
				{ href: "/settings/general", label: "General" },
				{ href: "/settings/monitors", label: "Monitors", current: true },
				{ href: "/settings/status-pages", label: "Status pages" },
				{ href: "/settings/members", label: "Members" },
				{ href: "/settings/billing", label: "Billing" },
			],
		},
		{
			label: "Account",
			items: [
				{ href: "/settings/profile", label: "Profile" },
				{ href: "/settings/notifications", label: "Notifications" },
			],
		},
	]}
	backHref="/settings"
	labels={{ nav: "Settings", back: "Settings" }}
>
	<SettingsSection
		title="Monitor defaults"
		description="Applied to every monitor you create from now on."
		form={{ action: "/settings/monitors" }}
		labels={{ save: "Save defaults" }}
	>
		<SettingsSection.Row label="Alert email" description="Where down alerts go." htmlFor="alert-email">
			<Input id="alert-email" name="alertEmail" type="email" defaultValue="oncall@acme.dev" />
		</SettingsSection.Row>
	</SettingsSection>
</SettingsLayout>

// On /settings itself, render the nav alone on a phone:
<SettingsLayout sections={sections} page="index" labels={{ nav: "Settings", back: "Settings" }} />`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	flush: true,
	viewports: true,
	render: () => (
		<SettingsLayout
			sections={NAV}
			backHref="#settings"
			labels={{ nav: "Settings", back: "Settings" }}
			mix={[is("100%")]}
		>
			<SettingsSection
				title="Monitor defaults"
				description="Applied to every monitor you create from now on."
				form={{ action: "/examples/settings/monitors" }}
				labels={{ save: "Save defaults" }}
			>
				<SettingsSection.Row
					label="Alert email"
					description="Where down alerts go."
					htmlFor="preview-settings-layout-email"
				>
					<Input
						id="preview-settings-layout-email"
						name="alertEmail"
						type="email"
						defaultValue="oncall@acme.dev"
					/>
				</SettingsSection.Row>
				<SettingsSection.Row
					label="Regions"
					description="Each check runs from every region you pick."
					htmlFor="preview-settings-layout-regions"
				>
					<Input
						id="preview-settings-layout-regions"
						name="regions"
						defaultValue="Frankfurt, Iowa, Sydney"
					/>
				</SettingsSection.Row>
			</SettingsSection>
		</SettingsLayout>
	),
};
