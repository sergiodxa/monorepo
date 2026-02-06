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
	},
};

export default meta;
type Story = StoryObj<typeof Spinner>;

export const Default: Story = {};

export const Sizes: Story = {
	render: () => (
		<div className="flex items-center gap-4">
			<Spinner size="sm" aria-label="Loading small" />
			<Spinner size="md" aria-label="Loading medium" />
			<Spinner size="lg" aria-label="Loading large" />
		</div>
	),
};

export const Colors: Story = {
	render: () => (
		<div className="flex items-center gap-4">
			<Spinner color="primary" aria-label="Primary" />
			<Spinner color="neutral" aria-label="Neutral" />
			<Spinner color="success" aria-label="Success" />
			<Spinner color="warning" aria-label="Warning" />
			<Spinner color="danger" aria-label="Danger" />
		</div>
	),
};
