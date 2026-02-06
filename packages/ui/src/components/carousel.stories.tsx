import type { Meta, StoryObj } from "@storybook/react";
import type { CSSProperties } from "react";

import { Button } from "react-aria-components";

import { Button as UIButton } from "./button";
import { Card } from "./card";
import { Carousel } from "./carousel";

interface StoryArgs {
	label: string;
	slideSize: string;
	gap: string;
	padding: string;
}

const meta: Meta<StoryArgs> = {
	title: "Layout/Carousel",
	component: Carousel as unknown as Meta<StoryArgs>["component"],
	args: {
		label: "Featured releases",
		slideSize: "18rem",
		gap: "1rem",
		padding: "0rem",
	},
};

export default meta;
type Story = StoryObj<StoryArgs>;

const items = [
	{
		title: "Atlas overview",
		category: "Product",
		copy: "Explore the fastest way to ship analytics without reinventing dashboards.",
	},
	{
		title: "Workflow alerts",
		category: "Operations",
		copy: "Stay ahead of failures with automated alerting and recovery hints.",
	},
	{
		title: "Design system",
		category: "Design",
		copy: "Collect the core components your team can remix for new experiences.",
	},
	{
		title: "Launch checklist",
		category: "Marketing",
		copy: "Plan the story arc, coordinate assets, and ship launch content together.",
	},
	{
		title: "Research vault",
		category: "Insights",
		copy: "Keep your best customer interviews searchable and ready for planning.",
	},
];

export const Default: Story = {
	render: ({ label, slideSize, gap, padding }) => (
		<Carousel
			aria-label={label}
			className="w-full max-w-4xl"
			style={
				{
					"--ui-carousel-slide-size": slideSize,
					"--ui-carousel-gap": gap,
					"--ui-carousel-padding": padding,
				} as CSSProperties
			}
		>
			<Carousel.Viewport>
				<Carousel.Track>
					{items.map((item, index) => (
						<Carousel.Slide key={item.title} aria-label={`${index + 1} of ${items.length}`}>
							<Card className="h-full">
								<Card.Header>
									<span className="text-xs uppercase tracking-[0.2em] text-neutral-500">
										{item.category}
									</span>
									<Card.Title className="text-lg">{item.title}</Card.Title>
									<Card.Description>{item.copy}</Card.Description>
								</Card.Header>
								<Card.Content>
									<ul className="space-y-2 text-sm text-neutral-600 dark:text-neutral-300">
										<li>Team-ready resources</li>
										<li>Step-by-step guidance</li>
										<li>Progress check-ins</li>
									</ul>
								</Card.Content>
							</Card>
						</Carousel.Slide>
					))}
				</Carousel.Track>
			</Carousel.Viewport>
			<Carousel.Controls>
				<Carousel.Previous />
				<Carousel.Next />
			</Carousel.Controls>
		</Carousel>
	),
};

export const CustomButtons: Story = {
	render: ({ label, slideSize, gap, padding }) => (
		<Carousel
			aria-label={label}
			className="w-full max-w-4xl"
			style={
				{
					"--ui-carousel-slide-size": slideSize,
					"--ui-carousel-gap": gap,
					"--ui-carousel-padding": padding,
				} as CSSProperties
			}
		>
			<Carousel.Viewport>
				<Carousel.Track>
					{items.map((item, index) => (
						<Carousel.Slide key={item.title} aria-label={`${index + 1} of ${items.length}`}>
							<Card className="h-full">
								<Card.Header>
									<span className="text-xs uppercase tracking-[0.2em] text-neutral-500">
										{item.category}
									</span>
									<Card.Title className="text-lg">{item.title}</Card.Title>
									<Card.Description>{item.copy}</Card.Description>
								</Card.Header>
							</Card>
						</Carousel.Slide>
					))}
				</Carousel.Track>
			</Carousel.Viewport>
			<Carousel.Controls>
				<Carousel.Previous>
					<UIButton slot="previous" variant="outline" color="neutral">
						Back
					</UIButton>
				</Carousel.Previous>
				<Carousel.Next>
					<UIButton slot="next" variant="outline" color="neutral">
						Forward
					</UIButton>
				</Carousel.Next>
			</Carousel.Controls>
		</Carousel>
	),
};

export const WithRAButton: Story = {
	name: "With React Aria Button",
	render: ({ label, slideSize, gap, padding }) => (
		<Carousel
			aria-label={label}
			className="w-full max-w-4xl"
			style={
				{
					"--ui-carousel-slide-size": slideSize,
					"--ui-carousel-gap": gap,
					"--ui-carousel-padding": padding,
				} as CSSProperties
			}
		>
			<Carousel.Viewport>
				<Carousel.Track>
					{items.map((item, index) => (
						<Carousel.Slide key={item.title} aria-label={`${index + 1} of ${items.length}`}>
							<Card className="h-full">
								<Card.Header>
									<span className="text-xs uppercase tracking-[0.2em] text-neutral-500">
										{item.category}
									</span>
									<Card.Title className="text-lg">{item.title}</Card.Title>
								</Card.Header>
							</Card>
						</Carousel.Slide>
					))}
				</Carousel.Track>
			</Carousel.Viewport>
			<Carousel.Controls>
				<Carousel.Previous>
					<Button slot="previous" className="ui-button" data-variant="ghost" data-color="neutral">
						Prev
					</Button>
				</Carousel.Previous>
				<Carousel.Next>
					<Button slot="next" className="ui-button" data-variant="ghost" data-color="neutral">
						Next
					</Button>
				</Carousel.Next>
			</Carousel.Controls>
		</Carousel>
	),
};
