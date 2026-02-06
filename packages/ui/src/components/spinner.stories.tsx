import type { Meta, StoryObj } from "@storybook/react";

import { Spinner } from "./spinner";

const meta: Meta<typeof Spinner> = {
	title: "Feedback/Spinner",
	component: Spinner,
	argTypes: {
		size: {
			control: "radio",
			options: ["sm", "md", "lg"],
		},
		color: {
			control: "select",
			options: ["primary", "neutral", "success", "warning", "danger"],
		},
	},
	args: {
		size: "md",
		color: "primary",
	},
};

export default meta;
type Story = StoryObj<typeof Spinner>;

export const Default: Story = {
	render: (args) => (
		<Spinner {...args}>
			<Spinner.Ring />
			<Spinner.Label>Loading...</Spinner.Label>
		</Spinner>
	),
};

export const RingOnly: Story = {
	render: (args) => (
		<Spinner {...args} aria-label="Loading">
			<Spinner.Ring />
		</Spinner>
	),
};

export const Sizes: Story = {
	render: () => (
		<div className="flex items-center gap-4">
			<Spinner size="sm">
				<Spinner.Ring />
				<Spinner.Label>Loading small</Spinner.Label>
			</Spinner>
			<Spinner size="md">
				<Spinner.Ring />
				<Spinner.Label>Loading medium</Spinner.Label>
			</Spinner>
			<Spinner size="lg">
				<Spinner.Ring />
				<Spinner.Label>Loading large</Spinner.Label>
			</Spinner>
		</div>
	),
};
