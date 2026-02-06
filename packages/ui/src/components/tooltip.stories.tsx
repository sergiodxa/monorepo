import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "./button";
import { Tooltip, TooltipTrigger } from "./tooltip";

const meta: Meta<typeof Tooltip> = {
	title: "Overlays/Tooltip",
	component: Tooltip,
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
type Story = StoryObj<typeof Tooltip>;

export const Default: Story = {
	render: (args) => (
		<TooltipTrigger>
			<Button>Hover me</Button>
			<Tooltip {...args}>This is a tooltip</Tooltip>
		</TooltipTrigger>
	),
};

export const PlacementTop: Story = {
	render: () => (
		<div className="flex h-32 items-end justify-center">
			<TooltipTrigger>
				<Button>Hover me</Button>
				<Tooltip placement="top">Tooltip on top</Tooltip>
			</TooltipTrigger>
		</div>
	),
};

export const PlacementBottom: Story = {
	render: () => (
		<TooltipTrigger>
			<Button>Hover me</Button>
			<Tooltip placement="bottom">Tooltip on bottom</Tooltip>
		</TooltipTrigger>
	),
};

export const PlacementLeft: Story = {
	render: () => (
		<div className="flex justify-end">
			<TooltipTrigger>
				<Button>Hover me</Button>
				<Tooltip placement="left">Tooltip on left</Tooltip>
			</TooltipTrigger>
		</div>
	),
};

export const PlacementRight: Story = {
	render: () => (
		<TooltipTrigger>
			<Button>Hover me</Button>
			<Tooltip placement="right">Tooltip on right</Tooltip>
		</TooltipTrigger>
	),
};

export const AllPlacements: Story = {
	render: () => (
		<div className="flex flex-wrap items-center justify-center gap-8 p-16">
			<TooltipTrigger>
				<Button>Top</Button>
				<Tooltip placement="top">Placement: top</Tooltip>
			</TooltipTrigger>

			<TooltipTrigger>
				<Button>Bottom</Button>
				<Tooltip placement="bottom">Placement: bottom</Tooltip>
			</TooltipTrigger>

			<TooltipTrigger>
				<Button>Left</Button>
				<Tooltip placement="left">Placement: left</Tooltip>
			</TooltipTrigger>

			<TooltipTrigger>
				<Button>Right</Button>
				<Tooltip placement="right">Placement: right</Tooltip>
			</TooltipTrigger>
		</div>
	),
};

export const WithoutArrow: Story = {
	render: () => (
		<TooltipTrigger>
			<Button>Hover me</Button>
			<Tooltip showArrow={false}>Tooltip without arrow</Tooltip>
		</TooltipTrigger>
	),
};

export const WithArrow: Story = {
	render: () => (
		<TooltipTrigger>
			<Button>Hover me</Button>
			<Tooltip showArrow>Tooltip with arrow</Tooltip>
		</TooltipTrigger>
	),
};

export const LongContent: Story = {
	render: () => (
		<TooltipTrigger>
			<Button>Hover for details</Button>
			<Tooltip className="max-w-xs">
				This is a longer tooltip that contains more detailed information about the element you are
				hovering over.
			</Tooltip>
		</TooltipTrigger>
	),
};

export const OnFocusableElement: Story = {
	render: () => (
		<TooltipTrigger>
			<Button variant="outline">Focus or hover me</Button>
			<Tooltip>Tooltips work on focus too</Tooltip>
		</TooltipTrigger>
	),
};
