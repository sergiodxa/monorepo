import type { Meta, StoryObj } from "@storybook/react";

import { Badge } from "./badge";
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
		color: "neutral",
	},
	argTypes: {
		title: { control: "text" },
		description: { control: "text" },
		content: { control: "text" },
		footer: { control: "text" },
		showDescription: { control: "boolean" },
		showFooter: { control: "boolean" },
		className: { control: "text" },
		color: {
			control: "select",
			options: ["primary", "neutral", "success", "warning", "danger"],
		},
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

export const Colors: Story = {
	render: () => (
		<div className="grid grid-cols-2 gap-4">
			<Card color="neutral" className="max-w-xs">
				<Card.Header>
					<Card.Title>Neutral Card</Card.Title>
					<Card.Description>Default neutral styling</Card.Description>
				</Card.Header>
				<Card.Footer>
					<Button size="sm">Action</Button>
				</Card.Footer>
			</Card>

			<Card color="primary" className="max-w-xs">
				<Card.Header>
					<Card.Title>Primary Card</Card.Title>
					<Card.Description>Highlighted content</Card.Description>
				</Card.Header>
				<Card.Footer>
					<Button size="sm">Action</Button>
				</Card.Footer>
			</Card>

			<Card color="success" className="max-w-xs">
				<Card.Header>
					<Card.Title>Success Card</Card.Title>
					<Card.Description>Positive feedback</Card.Description>
				</Card.Header>
				<Card.Footer>
					<Button size="sm">Action</Button>
				</Card.Footer>
			</Card>

			<Card color="warning" className="max-w-xs">
				<Card.Header>
					<Card.Title>Warning Card</Card.Title>
					<Card.Description>Attention needed</Card.Description>
				</Card.Header>
				<Card.Footer>
					<Button size="sm">Action</Button>
				</Card.Footer>
			</Card>

			<Card color="danger" className="max-w-xs">
				<Card.Header>
					<Card.Title>Danger Card</Card.Title>
					<Card.Description>Critical information</Card.Description>
				</Card.Header>
				<Card.Footer>
					<Button size="sm">Action</Button>
				</Card.Footer>
			</Card>
		</div>
	),
};

export const ColorInheritance: Story = {
	render: () => (
		<div className="flex flex-col gap-4">
			<Card color="primary" className="max-w-md">
				<Card.Header>
					<Card.Title>Primary Card with Inherited Colors</Card.Title>
					<Card.Description>
						Nested components inherit the primary color from the Card
					</Card.Description>
				</Card.Header>
				<Card.Content className="flex gap-2">
					<Badge>Inherits primary</Badge>
					<Badge color="danger">Explicit danger</Badge>
				</Card.Content>
				<Card.Footer className="gap-2">
					<Button variant="outline" size="sm">
						Inherits primary
					</Button>
					<Button color="neutral" variant="outline" size="sm">
						Explicit neutral
					</Button>
				</Card.Footer>
			</Card>

			<Card color="danger" className="max-w-md">
				<Card.Header>
					<Card.Title>Danger Zone</Card.Title>
					<Card.Description>All nested components inherit danger color by default</Card.Description>
				</Card.Header>
				<Card.Content className="flex gap-2">
					<Badge>Inherits danger</Badge>
					<Badge color="success">Explicit success</Badge>
				</Card.Content>
				<Card.Footer className="gap-2">
					<Button size="sm">Delete Account</Button>
					<Button color="neutral" variant="outline" size="sm">
						Cancel
					</Button>
				</Card.Footer>
			</Card>
		</div>
	),
};
