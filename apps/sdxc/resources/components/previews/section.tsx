/**
 * Live preview island for `Section`. A group only reads as a group next to a second
 * one, so the example is a real account menu with two labeled runs of items and a
 * divider between them. The WAI-ARIA menu keyboard pattern is the consumer's to
 * apply, so the island carries the same `menuKeys()` wiring a reader would write —
 * without it the arrow keys never move between the items the sections hold.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { CreditCardIcon, LogOutIcon, SettingsIcon, UserIcon, UsersIcon } from "@sdxc/icons";
import { Button, Header, Menu, Section } from "@sdxc/ui";
import { menuKeys } from "@sdxc/ui/mixins";
import { clientEntry } from "remix/component";

/** The source the page shows, matching the markup below. */
const SECTION_CODE = `<Button commandfor="preview-account-menu" command="toggle-popover" variant="outline">
	Sergio Xalambrí
</Button>
<Menu id="preview-account-menu" aria-label="Account" mix={[menuKeys()]}>
	<Section aria-labelledby="preview-account-heading">
		<Header id="preview-account-heading">Account</Header>
		<Menu.Item href="/settings/profile">
			<UserIcon aria-hidden="true" />
			Profile
		</Menu.Item>
		<Menu.Item href="/settings/billing">
			<CreditCardIcon aria-hidden="true" />
			Billing
		</Menu.Item>
	</Section>

	<Menu.Separator />

	<Section aria-labelledby="preview-workspace-heading">
		<Header id="preview-workspace-heading">Workspace</Header>
		<Menu.Item href="/settings/members">
			<UsersIcon aria-hidden="true" />
			Members
		</Menu.Item>
		<Menu.Item href="/settings/general">
			<SettingsIcon aria-hidden="true" />
			General
		</Menu.Item>
	</Section>

	<Menu.Separator />

	<Menu.Item danger>
		<LogOutIcon aria-hidden="true" />
		Sign out
	</Menu.Item>
</Menu>`;

/** Two labeled runs of menu items, hydrated so the arrow keys walk them. */
export const SectionPreview = clientEntry(
	"/resources/components/previews/section.tsx#SectionPreview",
	function SectionPreview() {
		return () => (
			<>
				<Button commandfor="preview-account-menu" command="toggle-popover" variant="outline">
					Sergio Xalambrí
				</Button>
				<Menu id="preview-account-menu" aria-label="Account" mix={[menuKeys()]}>
					<Section aria-labelledby="preview-account-heading">
						<Header id="preview-account-heading">Account</Header>
						<Menu.Item href="/settings/profile">
							<UserIcon aria-hidden="true" />
							Profile
						</Menu.Item>
						<Menu.Item href="/settings/billing">
							<CreditCardIcon aria-hidden="true" />
							Billing
						</Menu.Item>
					</Section>

					<Menu.Separator />

					<Section aria-labelledby="preview-workspace-heading">
						<Header id="preview-workspace-heading">Workspace</Header>
						<Menu.Item href="/settings/members">
							<UsersIcon aria-hidden="true" />
							Members
						</Menu.Item>
						<Menu.Item href="/settings/general">
							<SettingsIcon aria-hidden="true" />
							General
						</Menu.Item>
					</Section>

					<Menu.Separator />

					<Menu.Item danger>
						<LogOutIcon aria-hidden="true" />
						Sign out
					</Menu.Item>
				</Menu>
			</>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: SECTION_CODE, render: () => <SectionPreview /> };
