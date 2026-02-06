import type { Meta, StoryObj } from "@storybook/react";

import { Breadcrumb, Breadcrumbs } from "./breadcrumbs";

const meta: Meta<typeof Breadcrumbs> = {
	title: "Layout/Breadcrumbs",
	component: Breadcrumbs,
};

export default meta;
type Story = StoryObj<typeof Breadcrumbs>;

export const Default: Story = {
	render: (args) => (
		<Breadcrumbs {...args}>
			<Breadcrumb href="/">Home</Breadcrumb>
			<Breadcrumb href="/products">Products</Breadcrumb>
			<Breadcrumb>Electronics</Breadcrumb>
		</Breadcrumbs>
	),
};

export const WithLinks: Story = {
	render: () => (
		<Breadcrumbs>
			<Breadcrumb href="/">Home</Breadcrumb>
			<Breadcrumb href="/dashboard">Dashboard</Breadcrumb>
			<Breadcrumb href="/dashboard/settings">Settings</Breadcrumb>
			<Breadcrumb href="/dashboard/settings/profile">Profile</Breadcrumb>
		</Breadcrumbs>
	),
};

export const CurrentPage: Story = {
	render: () => (
		<Breadcrumbs>
			<Breadcrumb href="/">Home</Breadcrumb>
			<Breadcrumb href="/docs">Documentation</Breadcrumb>
			<Breadcrumb>Getting Started</Breadcrumb>
		</Breadcrumbs>
	),
};

export const SingleItem: Story = {
	render: () => (
		<Breadcrumbs>
			<Breadcrumb>Home</Breadcrumb>
		</Breadcrumbs>
	),
};

export const LongPath: Story = {
	render: () => (
		<Breadcrumbs>
			<Breadcrumb href="/">Home</Breadcrumb>
			<Breadcrumb href="/organization">Organization</Breadcrumb>
			<Breadcrumb href="/organization/team">Team</Breadcrumb>
			<Breadcrumb href="/organization/team/projects">Projects</Breadcrumb>
			<Breadcrumb href="/organization/team/projects/web-app">Web App</Breadcrumb>
			<Breadcrumb>Settings</Breadcrumb>
		</Breadcrumbs>
	),
};
