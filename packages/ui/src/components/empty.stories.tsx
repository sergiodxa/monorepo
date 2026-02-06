import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "./button";
import { Empty } from "./empty";

type StoryArgs = {
	color: "primary" | "success" | "warning" | "danger" | "neutral";
	title: string;
	description: string;
	showIcon: boolean;
	showAction: boolean;
	actionLabel: string;
};

const meta: Meta<StoryArgs> = {
	title: "Feedback/Empty",
	component: Empty as unknown as Meta<StoryArgs>["component"],
	args: {
		color: "neutral",
		title: "No activity yet",
		description: "When you create your first item, it will show up here.",
		showIcon: true,
		showAction: true,
		actionLabel: "Create item",
	},
	argTypes: {
		color: {
			control: "select",
			options: ["primary", "success", "warning", "danger", "neutral"],
		},
		title: { control: "text" },
		description: { control: "text" },
		showIcon: { control: "boolean" },
		showAction: { control: "boolean" },
		actionLabel: { control: "text" },
	},
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const Default: Story = {
	render: ({ title, description, showIcon, showAction, actionLabel, ...args }) => (
		<Empty {...args}>
			{showIcon ? (
				<Empty.Icon>
					<svg viewBox="0 0 24 24" className="size-5" aria-hidden>
						<path
							fill="currentColor"
							d="M12 3a9 9 0 019 9c0 4.3-3.05 7.9-7.1 8.75-.45.1-.9-.2-.9-.66V18.8c0-.7-.4-1.1-1.1-1.1H10c-.7 0-1.1.4-1.1 1.1v1.29c0 .46-.45.76-.9.66A9 9 0 0112 3zm-1.5 7.5a1.5 1.5 0 103 0 1.5 1.5 0 00-3 0zm1 3.25a.75.75 0 00-.75.75v2a.75.75 0 001.5 0v-2a.75.75 0 00-.75-.75z"
						/>
					</svg>
				</Empty.Icon>
			) : null}
			<Empty.Title>{title}</Empty.Title>
			<Empty.Description>{description}</Empty.Description>
			{showAction ? (
				<Empty.Action>
					<Button size="sm" color={args.color}>
						{actionLabel}
					</Button>
				</Empty.Action>
			) : null}
		</Empty>
	),
};

export const WithAccent: Story = {
	args: {
		color: "primary",
		title: "Nothing to review",
		description: "Bring in data from your integrations to get started.",
		showIcon: true,
		showAction: true,
		actionLabel: "Connect source",
	},
};
