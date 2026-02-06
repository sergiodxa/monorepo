import type { Meta, StoryObj } from "@storybook/react";

import { ToggleButton, ToggleButtonGroup } from "./toggle-button";

const meta: Meta<typeof ToggleButton> = {
	title: "Buttons/ToggleButton",
	component: ToggleButton,
	argTypes: {
		color: { control: "select", options: ["primary", "neutral", "danger", "warning", "success"] },
		variant: { control: "select", options: ["solid", "outline", "ghost"] },
		size: { control: "select", options: ["sm", "md", "lg"] },
	},
	args: {
		children: "Toggle",
		color: "neutral",
		variant: "outline",
		size: "md",
	},
};

export default meta;
type Story = StoryObj<typeof ToggleButton>;

export const Default: Story = {};

export const Selected: Story = {
	args: {
		defaultSelected: true,
		children: "Selected",
	},
};

export const Disabled: Story = {
	args: {
		isDisabled: true,
		children: "Disabled",
	},
};

export const ToggleButtonGroupSingle: Story = {
	render: () => (
		<ToggleButtonGroup selectionMode="single">
			<ToggleButton id="left">Left</ToggleButton>
			<ToggleButton id="center">Center</ToggleButton>
			<ToggleButton id="right">Right</ToggleButton>
		</ToggleButtonGroup>
	),
};

export const ToggleButtonGroupMultiple: Story = {
	render: () => (
		<ToggleButtonGroup selectionMode="multiple">
			<ToggleButton id="bold">Bold</ToggleButton>
			<ToggleButton id="italic">Italic</ToggleButton>
			<ToggleButton id="underline">Underline</ToggleButton>
		</ToggleButtonGroup>
	),
};
