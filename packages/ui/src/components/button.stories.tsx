import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "./button";

const meta: Meta<typeof Button> = {
	title: "Buttons/Button",
	component: Button,
	argTypes: {
		color: { control: "select", options: ["primary", "neutral", "danger", "warning", "success"] },
		variant: { control: "select", options: ["solid", "outline", "ghost"] },
		size: { control: "select", options: ["sm", "md", "lg"] },
	},
	args: {
		children: "Button",
		color: "primary",
		variant: "solid",
		size: "md",
	},
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {};

export const Disabled: Story = {
	args: {
		isDisabled: true,
		children: "Disabled",
	},
};
