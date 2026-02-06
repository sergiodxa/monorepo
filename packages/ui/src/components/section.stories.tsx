import type { Meta, StoryObj } from "@storybook/react";

import { Header } from "./header";
import { ListBox } from "./listbox";
import { Section } from "./section";

const meta: Meta<typeof Section> = {
	title: "Utility/Section",
	component: Section,
};

export default meta;
type Story = StoryObj<typeof Section>;

export const Default: Story = {
	render: (args) => (
		<ListBox aria-label="Account settings" selectionMode="single" className="w-64">
			<Section {...args}>
				<Header>Account</Header>
				<ListBox.Item id="profile">Profile</ListBox.Item>
				<ListBox.Item id="security">Security</ListBox.Item>
				<ListBox.Item id="billing">Billing</ListBox.Item>
			</Section>
		</ListBox>
	),
};

export const WithHeader: Story = {
	render: () => (
		<ListBox aria-label="Team settings" selectionMode="single" className="w-64">
			<Section>
				<Header>Team</Header>
				<ListBox.Item id="members">Members</ListBox.Item>
				<ListBox.Item id="roles">Roles</ListBox.Item>
				<ListBox.Item id="invites">Invitations</ListBox.Item>
			</Section>
		</ListBox>
	),
};

export const MultipleSections: Story = {
	render: () => (
		<ListBox aria-label="Workspace settings" selectionMode="single" className="w-64">
			<Section>
				<Header>Workspace</Header>
				<ListBox.Item id="overview">Overview</ListBox.Item>
				<ListBox.Item id="members">Members</ListBox.Item>
			</Section>
			<Section>
				<Header>Projects</Header>
				<ListBox.Item id="active">Active</ListBox.Item>
				<ListBox.Item id="archived">Archived</ListBox.Item>
			</Section>
			<Section>
				<Header>Security</Header>
				<ListBox.Item id="sessions">Sessions</ListBox.Item>
				<ListBox.Item id="devices">Devices</ListBox.Item>
			</Section>
		</ListBox>
	),
};

export const InMenuContext: Story = {
	render: () => (
		<ListBox aria-label="Navigation" selectionMode="single" className="w-56">
			<Section>
				<Header>Navigation</Header>
				<ListBox.Item id="dashboard">Dashboard</ListBox.Item>
				<ListBox.Item id="projects">Projects</ListBox.Item>
				<ListBox.Item id="tasks">Tasks</ListBox.Item>
			</Section>
			<Section>
				<Header>Settings</Header>
				<ListBox.Item id="preferences">Preferences</ListBox.Item>
				<ListBox.Item id="account">Account</ListBox.Item>
			</Section>
		</ListBox>
	),
};

export const CardLayout: Story = {
	render: () => (
		<ListBox aria-label="User profile" selectionMode="none" className="w-80">
			<Section className="px-4 py-3">
				<Header>User Profile</Header>
				<ListBox.Item id="name" className="flex items-center justify-between">
					<span>Name</span>
					<span className="text-gray-500">John Doe</span>
				</ListBox.Item>
				<ListBox.Item id="email" className="flex items-center justify-between">
					<span>Email</span>
					<span className="text-gray-500">john@example.com</span>
				</ListBox.Item>
				<ListBox.Item id="since" className="flex items-center justify-between">
					<span>Member since</span>
					<span className="text-gray-500">Jan 2024</span>
				</ListBox.Item>
			</Section>
		</ListBox>
	),
};
