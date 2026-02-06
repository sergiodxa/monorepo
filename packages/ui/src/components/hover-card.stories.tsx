import type { Meta, StoryObj } from "@storybook/react";

import { Avatar } from "./avatar";
import { Button } from "./button";
import { Heading } from "./heading";
import { HoverCard, HoverCardTrigger } from "./hover-card";
import { Text } from "./text";

const meta: Meta<typeof HoverCard> = {
	title: "Overlays/Hover Card",
	component: HoverCard,
	args: {
		placement: "top",
		showArrow: true,
	},
	argTypes: {
		placement: {
			control: "select",
			options: [
				"top",
				"bottom",
				"left",
				"right",
				"top start",
				"top end",
				"bottom start",
				"bottom end",
			],
		},
		showArrow: {
			control: "boolean",
		},
	},
};

export default meta;
type Story = StoryObj<typeof HoverCard>;

export const Default: Story = {
	render: (args) => (
		<HoverCardTrigger>
			<Button variant="outline">Hover profile</Button>
			<HoverCard {...args}>
				<div className="flex items-start gap-3">
					<Avatar fallback="SR" className="size-10" />
					<div className="space-y-1">
						<Heading level={4} className="text-sm font-semibold">
							Sergio Xalambrí
						</Heading>
						<Text className="text-sm text-neutral-600 dark:text-neutral-300">
							Web developer working on Daffy
						</Text>
						<div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
							<span>Madrid</span>
							<span>•</span>
							<span>Available for chat</span>
						</div>
					</div>
				</div>
			</HoverCard>
		</HoverCardTrigger>
	),
};

export const WithActions: Story = {
	render: () => (
		<HoverCardTrigger>
			<Button variant="ghost">Team overview</Button>
			<HoverCard placement="bottom" showArrow>
				<div className="space-y-3">
					<Heading level={4} className="text-sm font-semibold">
						Atlas team
					</Heading>
					<Text className="text-sm text-neutral-600 dark:text-neutral-300">
						Monitoring and incident response across 12 regions.
					</Text>
					<div className="flex items-center gap-2">
						<Button size="sm">View dashboard</Button>
						<Button size="sm" variant="outline" color="neutral">
							Message
						</Button>
					</div>
				</div>
			</HoverCard>
		</HoverCardTrigger>
	),
};
