import type { Meta, StoryObj } from "@storybook/react";

import { Avatar } from "./avatar";

const meta: Meta<typeof Avatar> = {
	title: "Utility/Avatar",
	component: Avatar,
	args: {
		src: "https://i.pravatar.cc/96?img=12",
		alt: "Alex Doe",
		fallback: "AD",
	},
	argTypes: {
		src: { control: "text" },
		alt: { control: "text" },
		fallback: { control: "text" },
	},
};

export default meta;
type Story = StoryObj<typeof Avatar>;

export const Default: Story = {};

export const WithFallback: Story = {
	args: {
		src: "",
		alt: "Jamie Stone",
		fallback: "JS",
	},
};
