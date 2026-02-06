import type { Meta, StoryObj } from "@storybook/react";

import { LinkButton } from "./link-button";

const meta: Meta<typeof LinkButton> = {
	title: "Buttons/LinkButton",
	component: LinkButton,
	argTypes: {
		color: { control: "select", options: ["primary", "neutral", "danger", "warning", "success"] },
		variant: { control: "select", options: ["solid", "outline", "ghost"] },
		size: { control: "select", options: ["sm", "md", "lg"] },
	},
	args: {
		children: "Link Button",
		href: "#",
		color: "primary",
		variant: "solid",
		size: "md",
	},
};

export default meta;
type Story = StoryObj<typeof LinkButton>;

export const Default: Story = {};

export const Disabled: Story = {
	args: {
		isDisabled: true,
		children: "Disabled",
	},
};
