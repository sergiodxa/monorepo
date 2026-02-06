import type { Meta, StoryObj } from "@storybook/react";

import { Switch } from "./switch";

const meta: Meta<typeof Switch> = {
	title: "Selection/Switch",
	component: Switch,
	argTypes: {
		isDisabled: { control: "boolean" },
	},
	args: {
		children: "Enable notifications",
		isDisabled: false,
	},
};

export default meta;
type Story = StoryObj<typeof Switch>;

export const Default: Story = {};

export const Selected: Story = {
	args: {
		defaultSelected: true,
		children: "Notifications enabled",
	},
};

export const Disabled: Story = {
	args: {
		isDisabled: true,
		children: "Disabled switch",
	},
};

export const DisabledSelected: Story = {
	args: {
		isDisabled: true,
		isSelected: true,
		children: "Disabled enabled",
	},
};

export const WithoutLabel: Story = {
	args: {
		children: undefined,
		"aria-label": "Toggle feature",
	},
};

export const MultipleOptions: Story = {
	render: () => (
		<div className="flex flex-col gap-4">
			<Switch>Email notifications</Switch>
			<Switch>Push notifications</Switch>
			<Switch defaultSelected>SMS notifications</Switch>
			<Switch>Weekly digest</Switch>
		</div>
	),
};
