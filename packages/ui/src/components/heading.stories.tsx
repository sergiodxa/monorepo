import type { Meta, StoryObj } from "@storybook/react";

import { Heading } from "./heading";

const meta: Meta<typeof Heading> = {
	title: "Typography/Heading",
	component: Heading,
	args: {
		level: 1,
	},
	argTypes: {
		level: { control: "select", options: [1, 2, 3, 4, 5, 6] },
	},
};

export default meta;
type Story = StoryObj<typeof Heading>;

export const Default: Story = {
	render: (args) => (
		<Heading {...args} className="text-2xl font-bold">
			Default Heading
		</Heading>
	),
};

export const AllLevels: Story = {
	render: () => (
		<div className="flex flex-col gap-4">
			<Heading level={1} className="text-4xl font-bold">
				Heading Level 1
			</Heading>
			<Heading level={2} className="text-3xl font-bold">
				Heading Level 2
			</Heading>
			<Heading level={3} className="text-2xl font-semibold">
				Heading Level 3
			</Heading>
			<Heading level={4} className="text-xl font-semibold">
				Heading Level 4
			</Heading>
			<Heading level={5} className="text-lg font-medium">
				Heading Level 5
			</Heading>
			<Heading level={6} className="text-base font-medium">
				Heading Level 6
			</Heading>
		</div>
	),
};

export const WithParagraph: Story = {
	render: () => (
		<article className="max-w-prose">
			<Heading level={1} className="mb-4 text-3xl font-bold">
				Article Title
			</Heading>
			<p className="mb-6 text-gray-600">
				This is the introduction paragraph that follows the main heading. It provides context for
				the content that follows.
			</p>
			<Heading level={2} className="mb-3 text-xl font-semibold">
				First Section
			</Heading>
			<p className="mb-4 text-gray-600">
				Content for the first section goes here. This demonstrates how headings work with body text.
			</p>
			<Heading level={2} className="mb-3 text-xl font-semibold">
				Second Section
			</Heading>
			<p className="text-gray-600">
				Content for the second section. The heading hierarchy helps organize the content.
			</p>
		</article>
	),
};

export const InCard: Story = {
	render: () => (
		<div className="w-80 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
			<Heading level={3} className="mb-2 text-lg font-semibold">
				Card Title
			</Heading>
			<p className="text-sm text-gray-600">
				This is some card content that appears below the heading.
			</p>
		</div>
	),
};

export const WithColor: Story = {
	render: () => (
		<div className="flex flex-col gap-4">
			<Heading className="text-2xl font-bold text-gray-900">Default Color</Heading>
			<Heading className="text-2xl font-bold text-blue-600">Primary Color</Heading>
			<Heading className="text-2xl font-bold text-green-600">Success Color</Heading>
			<Heading className="text-2xl font-bold text-red-600">Danger Color</Heading>
		</div>
	),
};
