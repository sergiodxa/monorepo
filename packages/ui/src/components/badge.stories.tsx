import type { Meta, StoryObj } from "@storybook/react";

import { Badge } from "./badge";

const meta: Meta<typeof Badge> = {
	title: "Data Display/Badge",
	component: Badge,
	args: {
		children: "New",
		color: "neutral",
		variant: "default",
	},
	argTypes: {
		color: {
			control: "select",
			options: ["primary", "neutral", "success", "warning", "danger"],
		},
		variant: {
			control: "select",
			options: ["default", "secondary", "outline"],
		},
	},
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {};

export const WithIcon: Story = {
	args: {
		children: (
			<>
				<Badge.Icon>
					<svg viewBox="0 0 20 20" aria-hidden>
						<path
							fill="currentColor"
							d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11H9v-2h2v2zm0-4H9V5h2v4z"
						/>
					</svg>
				</Badge.Icon>
				<Badge.Text>Beta</Badge.Text>
			</>
		),
	},
};
