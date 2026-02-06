import type { Meta, StoryObj } from "@storybook/react";

import { Sidebar } from "./sidebar";

type StoryArgs = {
	currentItem: "dashboard" | "team" | "settings";
	itemColor: "primary" | "neutral" | "success" | "warning" | "danger";
};

const meta: Meta<StoryArgs> = {
	title: "Navigation/Sidebar",
	component: Sidebar as unknown as Meta<StoryArgs>["component"],
	args: {
		currentItem: "dashboard",
		itemColor: "neutral",
	},
	argTypes: {
		currentItem: {
			control: "select",
			options: ["dashboard", "team", "settings"],
		},
		itemColor: {
			control: "select",
			options: ["primary", "neutral", "success", "warning", "danger"],
		},
	},
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const Default: Story = {
	render: ({ currentItem, itemColor }) => (
		<Sidebar>
			<Sidebar.Header>Acme</Sidebar.Header>
			<Sidebar.Content>
				<Sidebar.Nav>
					<Sidebar.Item href="#" current={currentItem === "dashboard"} color={itemColor}>
						Dashboard
					</Sidebar.Item>
					<Sidebar.Item href="#" current={currentItem === "team"} color={itemColor}>
						Team
					</Sidebar.Item>
					<Sidebar.Item href="#" current={currentItem === "settings"} color={itemColor}>
						Settings
					</Sidebar.Item>
				</Sidebar.Nav>
			</Sidebar.Content>
			<Sidebar.Footer>Signed in as Alex</Sidebar.Footer>
		</Sidebar>
	),
};

export const WithSections: Story = {
	render: () => (
		<Sidebar>
			<Sidebar.Header>Workspace</Sidebar.Header>
			<Sidebar.Content>
				<Sidebar.Nav>
					<Sidebar.Item href="#" current>
						Overview
					</Sidebar.Item>
					<Sidebar.Item href="#">Reports</Sidebar.Item>
					<Sidebar.Item href="#">Automation</Sidebar.Item>
				</Sidebar.Nav>
				<Sidebar.Nav>
					<Sidebar.Item href="#">Settings</Sidebar.Item>
					<Sidebar.Item href="#">Integrations</Sidebar.Item>
					<Sidebar.Item href="#">Billing</Sidebar.Item>
				</Sidebar.Nav>
			</Sidebar.Content>
			<Sidebar.Footer>v2.4.1</Sidebar.Footer>
		</Sidebar>
	),
};
