import type { Meta, StoryObj } from "@storybook/react";

import { Breadcrumb, BreadcrumbLink, Breadcrumbs } from "./breadcrumbs";

const meta: Meta<typeof Breadcrumbs> = {
	title: "Layout/Breadcrumbs",
	component: Breadcrumbs,
};

export default meta;
type Story = StoryObj<typeof Breadcrumbs>;

export const Default: Story = {
	render: (args) => (
		<Breadcrumbs {...args}>
			<Breadcrumb>
				<BreadcrumbLink href="/">Home</BreadcrumbLink>
			</Breadcrumb>
			<Breadcrumb>
				<BreadcrumbLink href="/products">Products</BreadcrumbLink>
			</Breadcrumb>
			<Breadcrumb>
				<BreadcrumbLink>Electronics</BreadcrumbLink>
			</Breadcrumb>
		</Breadcrumbs>
	),
};

export const WithLinks: Story = {
	render: () => (
		<Breadcrumbs>
			<Breadcrumb>
				<BreadcrumbLink href="/">Home</BreadcrumbLink>
			</Breadcrumb>
			<Breadcrumb>
				<BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
			</Breadcrumb>
			<Breadcrumb>
				<BreadcrumbLink href="/dashboard/settings">Settings</BreadcrumbLink>
			</Breadcrumb>
			<Breadcrumb>
				<BreadcrumbLink href="/dashboard/settings/profile">Profile</BreadcrumbLink>
			</Breadcrumb>
		</Breadcrumbs>
	),
};

export const CurrentPage: Story = {
	render: () => (
		<Breadcrumbs>
			<Breadcrumb>
				<BreadcrumbLink href="/">Home</BreadcrumbLink>
			</Breadcrumb>
			<Breadcrumb>
				<BreadcrumbLink href="/docs">Documentation</BreadcrumbLink>
			</Breadcrumb>
			<Breadcrumb>
				<BreadcrumbLink>Getting Started</BreadcrumbLink>
			</Breadcrumb>
		</Breadcrumbs>
	),
};

export const SingleItem: Story = {
	render: () => (
		<Breadcrumbs>
			<Breadcrumb>
				<BreadcrumbLink>Home</BreadcrumbLink>
			</Breadcrumb>
		</Breadcrumbs>
	),
};

export const LongPath: Story = {
	render: () => (
		<Breadcrumbs>
			<Breadcrumb>
				<BreadcrumbLink href="/">Home</BreadcrumbLink>
			</Breadcrumb>
			<Breadcrumb>
				<BreadcrumbLink href="/organization">Organization</BreadcrumbLink>
			</Breadcrumb>
			<Breadcrumb>
				<BreadcrumbLink href="/organization/team">Team</BreadcrumbLink>
			</Breadcrumb>
			<Breadcrumb>
				<BreadcrumbLink href="/organization/team/projects">Projects</BreadcrumbLink>
			</Breadcrumb>
			<Breadcrumb>
				<BreadcrumbLink href="/organization/team/projects/web-app">Web App</BreadcrumbLink>
			</Breadcrumb>
			<Breadcrumb>
				<BreadcrumbLink>Settings</BreadcrumbLink>
			</Breadcrumb>
		</Breadcrumbs>
	),
};
