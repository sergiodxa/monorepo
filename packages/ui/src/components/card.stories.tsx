import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "./button";
import { Card } from "./card";

type StoryArgs = Card.Props & {
	title: string;
	description: string;
	content: string;
	footer: string;
	showDescription: boolean;
	showFooter: boolean;
};

const meta: Meta<StoryArgs> = {
	title: "Layout/Card",
	component: Card,
	args: {
		title: "Project overview",
		description: "Track milestones, budget, and delivery dates in one place.",
		content:
			"This quarter focuses on platform reliability and customer onboarding. Keep the scope tight and prioritize the launch checklist.",
		footer: "Last updated 2 hours ago",
		showDescription: true,
		showFooter: true,
		className: "max-w-md",
	},
	argTypes: {
		title: { control: "text" },
		description: { control: "text" },
		content: { control: "text" },
		footer: { control: "text" },
		showDescription: { control: "boolean" },
		showFooter: { control: "boolean" },
		className: { control: "text" },
	},
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const Default: Story = {
	render: ({ title, description, content, footer, showDescription, showFooter, ...args }) => (
		<Card {...args}>
			<Card.Header>
				<Card.Title>{title}</Card.Title>
				{showDescription ? <Card.Description>{description}</Card.Description> : null}
			</Card.Header>
			<Card.Content>{content}</Card.Content>
			{showFooter ? <Card.Footer>{footer}</Card.Footer> : null}
		</Card>
	),
};

export const WithActions: Story = {
	render: () => (
		<Card className="max-w-md">
			<Card.Header>
				<Card.Title>Upgrade your plan</Card.Title>
				<Card.Description>Unlock advanced analytics and priority support.</Card.Description>
			</Card.Header>
			<Card.Content>
				Teams on Pro can add custom dashboards, export reports, and set up unlimited alerts.
			</Card.Content>
			<Card.Footer className="justify-between">
				<span className="text-sm text-neutral-500">$24 per seat</span>
				<Button size="sm">Upgrade</Button>
			</Card.Footer>
		</Card>
	),
};
