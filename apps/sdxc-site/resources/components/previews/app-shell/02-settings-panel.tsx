/**
 * Live example for a swapped `AppShell` panel: on a settings screen the server draws a
 * "‹ Settings" back row and the settings sections in place of the app's nav, so the sidebar
 * never stacks two scopes. Esc follows the back row once the toggle island loads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BellIcon, CreditCardIcon, KeyIcon, SettingsIcon, UsersIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { text } from "@sdxc/u/typography";
import { Button } from "@sdxc/ui";
import { AppShell } from "@sdxc/ui/app/app-shell";
import { PageHeader } from "@sdxc/ui/app/page-header";

import { OpsShell } from "~/resources/components/previews/app-shell";

/** The source the page shows, matching the markup below. */
const CODE = `<AppShell
	labels={labels}
	workspace={workspace}
	footer={footer}
	nav={
		<>
			<AppShell.Back href="/monitors" label="Settings" />
			<AppShell.Group title="Workspace">
				<AppShell.Item href="/settings" icon={<SettingsIcon />} label="General" current />
				<AppShell.Item href="/settings/team" icon={<UsersIcon />} label="Team" />
				<AppShell.Item href="/settings/billing" icon={<CreditCardIcon />} label="Billing" />
			</AppShell.Group>
			<AppShell.Group title="Integrations">
				<AppShell.Item href="/settings/alerts" icon={<BellIcon />} label="Alert channels" />
				<AppShell.Item href="/settings/api-keys" icon={<KeyIcon />} label="API keys" />
			</AppShell.Group>
		</>
	}
>
	<PageHeader title="General" />
</AppShell>`;

/** What the preview registry reads: the title, the source to show, and the shell to draw. */
export default {
	title: "Settings panel swapped in for the nav",
	code: CODE,
	flush: true,
	render: () => (
		<OpsShell
			id="preview-app-shell-settings"
			nav={
				<>
					<AppShell.Back href="#monitors" label="Settings" />
					<AppShell.Group title="Workspace">
						<AppShell.Item href="#general" icon={<SettingsIcon />} label="General" current />
						<AppShell.Item href="#team" icon={<UsersIcon />} label="Team" />
						<AppShell.Item href="#billing" icon={<CreditCardIcon />} label="Billing" />
					</AppShell.Group>
					<AppShell.Group title="Integrations">
						<AppShell.Item href="#alerts" icon={<BellIcon />} label="Alert channels" />
						<AppShell.Item href="#api-keys" icon={<KeyIcon />} label="API keys" />
					</AppShell.Group>
				</>
			}
		>
			<PageHeader
				title="General"
				description="The workspace's name, URL and default time zone."
				primaryAction={<Button size="sm">Save changes</Button>}
			/>
			<p mix={[text("sm"), fg("neutral.muted")]}>Workspace name: Acme Ops</p>
		</OpsShell>
	),
};
