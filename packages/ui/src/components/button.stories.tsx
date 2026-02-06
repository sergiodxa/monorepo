import type { Meta, StoryObj } from "@storybook/react";

import { PlusIcon } from "lucide-react";

import { Button } from "./button";

const meta: Meta<typeof Button> = {
	title: "Buttons/Button",
	component: Button,
	argTypes: {
		color: { control: "select", options: ["primary", "neutral", "danger", "warning", "success"] },
		variant: { control: "select", options: ["solid", "outline", "ghost"] },
		size: { control: "select", options: ["sm", "md", "lg"] },
		isPending: { control: "boolean" },
	},
	args: {
		children: "Button",
		color: "primary",
		variant: "solid",
		size: "md",
		isPending: false,
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

export const Pending: Story = {
	args: {
		isPending: true,
		children: "Saving...",
	},
};

export const WithIcon: Story = {
	args: {
		children: (
			<>
				<PlusIcon className="size-4" />
				Add Item
			</>
		),
	},
};
