import type { Meta, StoryObj } from "@storybook/react";

import { Plus } from "lucide-react";

import { Avatar } from "./avatar";

const meta: Meta<typeof Avatar> = {
	title: "Utility/Avatar",
	component: Avatar,
	argTypes: {
		size: {
			control: "select",
			options: ["sm", "md", "lg"],
		},
	},
	args: {
		size: "md",
	},
};

export default meta;
type Story = StoryObj<typeof Avatar>;

export const Default: Story = {
	render: (args) => (
		<Avatar {...args}>
			<Avatar.Image src="https://i.pravatar.cc/96?img=12" alt="Alex Doe" />
			<Avatar.Fallback>AD</Avatar.Fallback>
		</Avatar>
	),
};

export const WithFallback: Story = {
	render: (args) => (
		<Avatar {...args}>
			<Avatar.Image src="" alt="Jamie Stone" />
			<Avatar.Fallback>JS</Avatar.Fallback>
		</Avatar>
	),
};

export const FallbackOnly: Story = {
	render: (args) => (
		<Avatar {...args}>
			<Avatar.Fallback>MK</Avatar.Fallback>
		</Avatar>
	),
};

export const WithBadge: Story = {
	render: (args) => (
		<Avatar {...args}>
			<Avatar.Image src="https://i.pravatar.cc/96?img=12" alt="Alex Doe" />
			<Avatar.Fallback>AD</Avatar.Fallback>
			<Avatar.Badge className="bg-green-500" />
		</Avatar>
	),
};

export const BadgeWithIcon: Story = {
	render: (args) => (
		<Avatar {...args}>
			<Avatar.Image src="https://i.pravatar.cc/96?img=5" alt="Pat Parker" />
			<Avatar.Fallback>PP</Avatar.Fallback>
			<Avatar.Badge className="flex items-center justify-center bg-primary-500">
				<Plus className="size-2 text-white" />
			</Avatar.Badge>
		</Avatar>
	),
};

export const Group: Story = {
	render: () => (
		<Avatar.Group>
			<Avatar>
				<Avatar.Image src="https://i.pravatar.cc/96?img=12" alt="User 1" />
				<Avatar.Fallback>U1</Avatar.Fallback>
			</Avatar>
			<Avatar>
				<Avatar.Image src="https://i.pravatar.cc/96?img=5" alt="User 2" />
				<Avatar.Fallback>U2</Avatar.Fallback>
			</Avatar>
			<Avatar>
				<Avatar.Image src="https://i.pravatar.cc/96?img=8" alt="User 3" />
				<Avatar.Fallback>U3</Avatar.Fallback>
			</Avatar>
		</Avatar.Group>
	),
};

export const GroupWithCount: Story = {
	render: () => (
		<Avatar.Group>
			<Avatar>
				<Avatar.Image src="https://i.pravatar.cc/96?img=12" alt="User 1" />
				<Avatar.Fallback>U1</Avatar.Fallback>
			</Avatar>
			<Avatar>
				<Avatar.Image src="https://i.pravatar.cc/96?img=5" alt="User 2" />
				<Avatar.Fallback>U2</Avatar.Fallback>
			</Avatar>
			<Avatar>
				<Avatar.Image src="https://i.pravatar.cc/96?img=8" alt="User 3" />
				<Avatar.Fallback>U3</Avatar.Fallback>
			</Avatar>
			<Avatar.Group.Count>+3</Avatar.Group.Count>
		</Avatar.Group>
	),
};

export const GroupCountWithIcon: Story = {
	render: () => (
		<Avatar.Group>
			<Avatar>
				<Avatar.Image src="https://i.pravatar.cc/96?img=12" alt="User 1" />
				<Avatar.Fallback>U1</Avatar.Fallback>
			</Avatar>
			<Avatar>
				<Avatar.Image src="https://i.pravatar.cc/96?img=5" alt="User 2" />
				<Avatar.Fallback>U2</Avatar.Fallback>
			</Avatar>
			<Avatar.Group.Count>
				<Plus className="size-4" />
			</Avatar.Group.Count>
		</Avatar.Group>
	),
};

export const Sizes: Story = {
	render: () => (
		<div className="flex items-center gap-4">
			<Avatar size="sm">
				<Avatar.Image src="https://i.pravatar.cc/96?img=12" alt="Small" />
				<Avatar.Fallback>SM</Avatar.Fallback>
			</Avatar>
			<Avatar size="md">
				<Avatar.Image src="https://i.pravatar.cc/96?img=12" alt="Medium" />
				<Avatar.Fallback>MD</Avatar.Fallback>
			</Avatar>
			<Avatar size="lg">
				<Avatar.Image src="https://i.pravatar.cc/96?img=12" alt="Large" />
				<Avatar.Fallback>LG</Avatar.Fallback>
			</Avatar>
		</div>
	),
};
