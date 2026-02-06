import type { Meta, StoryObj } from "@storybook/react";

import { Alert } from "./alert";
import { Button } from "./button";

type StoryArgs = {
	color: "primary" | "success" | "warning" | "danger" | "neutral";
	live: "polite" | "assertive" | "off";
	title: string;
	description: string;
	showIcon: boolean;
	showAction: boolean;
	actionLabel: string;
};

const meta: Meta<StoryArgs> = {
	title: "Feedback/Alert",
	component: Alert as unknown as Meta<StoryArgs>["component"],
	args: {
		color: "primary",
		live: "polite",
		title: "Information",
		description: "This is an informational alert message.",
		showIcon: true,
		showAction: false,
		actionLabel: "Renew Now",
	},
	argTypes: {
		color: {
			control: "select",
			options: ["primary", "success", "warning", "danger", "neutral"],
		},
		live: { control: "select", options: ["polite", "assertive", "off"] },
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
		<Alert {...args}>
			{showIcon ? (
				<Alert.Icon>
					<svg viewBox="0 0 20 20" aria-hidden>
						<path
							fill="currentColor"
							d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
						/>
					</svg>
				</Alert.Icon>
			) : null}
			<Alert.Content>
				<Alert.Title>{title}</Alert.Title>
				<Alert.Description>{description}</Alert.Description>
			</Alert.Content>
			{showAction ? (
				<Alert.Action>
					<Button size="sm" color={args.color}>
						{actionLabel}
					</Button>
				</Alert.Action>
			) : null}
		</Alert>
	),
};

export const IconAndAction: Story = {
	args: {
		color: "warning",
		live: "assertive",
		title: "Subscription Expiring",
		description: "Your subscription will expire in 3 days. Renew now to avoid interruption.",
		showIcon: true,
		showAction: true,
		actionLabel: "Renew Now",
	},
};
