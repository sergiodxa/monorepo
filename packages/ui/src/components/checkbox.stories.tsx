import type { Meta, StoryObj } from "@storybook/react";

import { Checkbox } from "./checkbox";

const meta: Meta<typeof Checkbox> = {
	title: "Selection/Checkbox",
	component: Checkbox,
	argTypes: {
		color: { control: "select", options: ["primary", "neutral", "danger", "warning", "success"] },
		isDisabled: { control: "boolean" },
		isInvalid: { control: "boolean" },
		isIndeterminate: { control: "boolean" },
	},
	args: {
		children: "Accept terms and conditions",
		color: "primary",
		isDisabled: false,
		isInvalid: false,
		isIndeterminate: false,
	},
};

export default meta;
type Story = StoryObj<typeof Checkbox>;

export const Default: Story = {};

export const Disabled: Story = {
	args: {
		isDisabled: true,
		children: "Disabled checkbox",
	},
};

export const DisabledChecked: Story = {
	args: {
		isDisabled: true,
		isSelected: true,
		children: "Disabled checked",
	},
};

export const Invalid: Story = {
	args: {
		isInvalid: true,
		children: "Invalid checkbox",
	},
};

export const Indeterminate: Story = {
	args: {
		isIndeterminate: true,
		children: "Indeterminate checkbox",
	},
};

export const WithoutLabel: Story = {
	args: {
		children: undefined,
		"aria-label": "Toggle option",
	},
};
