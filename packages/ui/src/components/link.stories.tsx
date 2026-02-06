import type { Meta, StoryObj } from "@storybook/react";

import { Link } from "./link";

const meta: Meta<typeof Link> = {
	title: "Navigation/Link",
	component: Link,
	argTypes: {
		color: { control: "select", options: ["primary", "neutral", "danger", "warning", "success"] },
		prefetch: { control: "select", options: [undefined, "intent", "render"] },
	},
	args: {
		children: "Link",
		href: "#",
		color: "primary",
	},
};

export default meta;
type Story = StoryObj<typeof Link>;

export const Default: Story = {};

export const External: Story = {
	args: {
		children: "Visit External Site",
		href: "https://example.com",
		target: "_blank",
	},
};

export const WithPrefetch: Story = {
	args: {
		children: "Settings",
		href: "/settings",
		prefetch: "intent",
	},
};

export const Disabled: Story = {
	args: {
		children: "Disabled Link",
		isDisabled: true,
	},
};
