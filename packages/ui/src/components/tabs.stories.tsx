import type { Meta, StoryObj } from "@storybook/react";

import { Tabs } from "./tabs";

const meta: Meta<typeof Tabs> = {
	title: "Layout/Tabs",
	component: Tabs,
	args: {
		orientation: "horizontal",
	},
	argTypes: {
		orientation: { control: "select", options: ["horizontal", "vertical"] },
	},
};

export default meta;
type Story = StoryObj<typeof Tabs>;

export const Default: Story = {
	render: (args) => (
		<Tabs {...args}>
			<Tabs.List>
				<Tabs.Tab id="account">Account</Tabs.Tab>
				<Tabs.Tab id="password">Password</Tabs.Tab>
				<Tabs.Tab id="notifications">Notifications</Tabs.Tab>
			</Tabs.List>
			<Tabs.Panels>
				<Tabs.Panel id="account">
					<p>Manage your account settings and preferences.</p>
				</Tabs.Panel>
				<Tabs.Panel id="password">
					<p>Change your password and security settings.</p>
				</Tabs.Panel>
				<Tabs.Panel id="notifications">
					<p>Configure your notification preferences.</p>
				</Tabs.Panel>
			</Tabs.Panels>
		</Tabs>
	),
};

export const WithIcons: Story = {
	render: () => (
		<Tabs>
			<Tabs.List>
				<Tabs.Tab id="home">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						className="inline-block mr-2"
					>
						<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
						<polyline points="9 22 9 12 15 12 15 22" />
					</svg>
					Home
				</Tabs.Tab>
				<Tabs.Tab id="settings">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						className="inline-block mr-2"
					>
						<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
						<circle cx="12" cy="12" r="3" />
					</svg>
					Settings
				</Tabs.Tab>
				<Tabs.Tab id="profile">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						className="inline-block mr-2"
					>
						<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
						<circle cx="12" cy="7" r="4" />
					</svg>
					Profile
				</Tabs.Tab>
			</Tabs.List>
			<Tabs.Panels>
				<Tabs.Panel id="home">
					<p>Welcome to your dashboard.</p>
				</Tabs.Panel>
				<Tabs.Panel id="settings">
					<p>Configure your application settings.</p>
				</Tabs.Panel>
				<Tabs.Panel id="profile">
					<p>Edit your profile information.</p>
				</Tabs.Panel>
			</Tabs.Panels>
		</Tabs>
	),
};

export const DisabledTabs: Story = {
	render: () => (
		<Tabs>
			<Tabs.List>
				<Tabs.Tab id="active">Active Tab</Tabs.Tab>
				<Tabs.Tab id="disabled" isDisabled>
					Disabled Tab
				</Tabs.Tab>
				<Tabs.Tab id="another">Another Tab</Tabs.Tab>
			</Tabs.List>
			<Tabs.Panels>
				<Tabs.Panel id="active">
					<p>This tab is active and accessible.</p>
				</Tabs.Panel>
				<Tabs.Panel id="disabled">
					<p>This content is for the disabled tab.</p>
				</Tabs.Panel>
				<Tabs.Panel id="another">
					<p>Another accessible tab content.</p>
				</Tabs.Panel>
			</Tabs.Panels>
		</Tabs>
	),
};

export const VerticalOrientation: Story = {
	render: () => (
		<Tabs orientation="vertical" className="flex gap-4">
			<Tabs.List className="flex flex-col">
				<Tabs.Tab id="general">General</Tabs.Tab>
				<Tabs.Tab id="security">Security</Tabs.Tab>
				<Tabs.Tab id="billing">Billing</Tabs.Tab>
				<Tabs.Tab id="team">Team</Tabs.Tab>
			</Tabs.List>
			<Tabs.Panels className="flex-1">
				<Tabs.Panel id="general">
					<p>General settings for your account.</p>
				</Tabs.Panel>
				<Tabs.Panel id="security">
					<p>Security and authentication options.</p>
				</Tabs.Panel>
				<Tabs.Panel id="billing">
					<p>Billing information and payment methods.</p>
				</Tabs.Panel>
				<Tabs.Panel id="team">
					<p>Manage your team members and permissions.</p>
				</Tabs.Panel>
			</Tabs.Panels>
		</Tabs>
	),
};

export const ControlledSelection: Story = {
	render: () => (
		<Tabs defaultSelectedKey="password">
			<Tabs.List>
				<Tabs.Tab id="account">Account</Tabs.Tab>
				<Tabs.Tab id="password">Password</Tabs.Tab>
				<Tabs.Tab id="notifications">Notifications</Tabs.Tab>
			</Tabs.List>
			<Tabs.Panels>
				<Tabs.Panel id="account">
					<p>Account settings content.</p>
				</Tabs.Panel>
				<Tabs.Panel id="password">
					<p>Password settings content (default selected).</p>
				</Tabs.Panel>
				<Tabs.Panel id="notifications">
					<p>Notification settings content.</p>
				</Tabs.Panel>
			</Tabs.Panels>
		</Tabs>
	),
};
