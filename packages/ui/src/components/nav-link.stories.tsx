import type { Meta, StoryObj } from "@storybook/react";

import { NavLink } from "./nav-link";

const meta: Meta<typeof NavLink> = {
	title: "Navigation/NavLink",
	component: NavLink,
	argTypes: {
		color: { control: "select", options: ["primary", "neutral", "danger", "warning", "success"] },
		prefetch: { control: "select", options: [undefined, "intent", "render", "none", "viewport"] },
	},
	args: {
		children: "NavLink",
		to: "#",
		color: "primary",
	},
};

export default meta;
type Story = StoryObj<typeof NavLink>;

/** Basic nav link with default settings */
export const Default: Story = {};

/** NavLink shows active state when the current URL matches */
export const Active: Story = {
	args: {
		to: "#",
		children: "Active Link",
		className: ({ isActive }) => (isActive ? "font-bold underline" : ""),
	},
};

/** NavLink shows pending state during navigation transitions */
export const Pending: Story = {
	args: {
		to: "/loading-page",
		children: "Pending Link",
		className: ({ isPending }) => (isPending ? "opacity-50" : ""),
	},
};

/** Example of a nav link styled for use in a navigation menu */
export const InNavigation: Story = {
	args: {
		to: "/dashboard",
		children: "Dashboard",
		color: "neutral",
	},
	decorators: [
		(Story) => (
			<nav className="flex gap-6">
				<Story />
			</nav>
		),
	],
};
