import type { Meta, StoryObj } from "@storybook/react";

import { Text } from "./text";

const meta: Meta<typeof Text> = {
	title: "Typography/Text",
	component: Text,
	args: {
		slot: undefined,
	},
	argTypes: {
		slot: { control: "text" },
	},
};

export default meta;
type Story = StoryObj<typeof Text>;

export const Default: Story = {
	render: (args) => <Text {...args}>This is some default text content.</Text>,
};

export const Sizes: Story = {
	render: () => (
		<div className="flex flex-col gap-2">
			<Text className="text-xs">Extra small text (xs)</Text>
			<Text className="text-sm">Small text (sm)</Text>
			<Text className="text-base">Base text (base)</Text>
			<Text className="text-lg">Large text (lg)</Text>
			<Text className="text-xl">Extra large text (xl)</Text>
			<Text className="text-2xl">2XL text</Text>
		</div>
	),
};

export const Weights: Story = {
	render: () => (
		<div className="flex flex-col gap-2">
			<Text className="font-light">Light weight text</Text>
			<Text className="font-normal">Normal weight text</Text>
			<Text className="font-medium">Medium weight text</Text>
			<Text className="font-semibold">Semibold weight text</Text>
			<Text className="font-bold">Bold weight text</Text>
		</div>
	),
};

export const Colors: Story = {
	render: () => (
		<div className="flex flex-col gap-2">
			<Text className="text-gray-900">Primary text color</Text>
			<Text className="text-gray-600">Secondary text color</Text>
			<Text className="text-gray-400">Muted text color</Text>
			<Text className="text-blue-600">Blue text</Text>
			<Text className="text-green-600">Green text</Text>
			<Text className="text-red-600">Red text</Text>
		</div>
	),
};

export const WithSlots: Story = {
	render: () => (
		<div className="flex flex-col gap-4">
			<div className="rounded-lg border border-gray-200 p-4">
				<Text slot="label" className="text-sm font-medium text-gray-700">
					Label slot
				</Text>
				<Text slot="description" className="text-sm text-gray-500">
					Description slot for additional context
				</Text>
			</div>
			<div className="rounded-lg border border-gray-200 p-4">
				<Text slot="errorMessage" className="text-sm text-red-600">
					Error message slot
				</Text>
			</div>
		</div>
	),
};

export const Paragraph: Story = {
	render: () => (
		<div className="max-w-prose">
			<Text className="leading-relaxed text-gray-700">
				This is a longer paragraph of text that demonstrates how the Text component can be used for
				body content. It includes multiple sentences to show how the text flows and wraps naturally.
				The component is flexible and can be styled using Tailwind classes for different use cases.
			</Text>
		</div>
	),
};

export const InlineText: Story = {
	render: () => (
		<p>
			This is regular text with{" "}
			<Text elementType="span" className="font-semibold text-blue-600">
				emphasized inline text
			</Text>{" "}
			that stands out from the rest.
		</p>
	),
};

export const InFormContext: Story = {
	render: () => (
		<div className="flex w-64 flex-col gap-1">
			<Text slot="label" className="text-sm font-medium text-gray-700">
				Email Address
			</Text>
			<input
				type="email"
				className="rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
				placeholder="you@example.com"
			/>
			<Text slot="description" className="text-xs text-gray-500">
				We&apos;ll never share your email with anyone else.
			</Text>
		</div>
	),
};
