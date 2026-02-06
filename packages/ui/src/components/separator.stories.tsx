import type { Meta, StoryObj } from "@storybook/react";

import { Separator } from "./separator";

const meta: Meta<typeof Separator> = {
	title: "Layout/Separator",
	component: Separator,
	args: {
		orientation: "horizontal",
	},
	argTypes: {
		orientation: { control: "select", options: ["horizontal", "vertical"] },
	},
};

export default meta;
type Story = StoryObj<typeof Separator>;

export const Default: Story = {
	render: (args) => (
		<div className="w-64">
			<p>Content above the separator</p>
			<Separator {...args} className="my-4" />
			<p>Content below the separator</p>
		</div>
	),
};

export const Horizontal: Story = {
	render: () => (
		<div className="w-64 space-y-4">
			<div>
				<h3 className="font-semibold">Section One</h3>
				<p className="text-sm text-gray-600">First section content</p>
			</div>
			<Separator orientation="horizontal" />
			<div>
				<h3 className="font-semibold">Section Two</h3>
				<p className="text-sm text-gray-600">Second section content</p>
			</div>
			<Separator orientation="horizontal" />
			<div>
				<h3 className="font-semibold">Section Three</h3>
				<p className="text-sm text-gray-600">Third section content</p>
			</div>
		</div>
	),
};

export const Vertical: Story = {
	render: () => (
		<div className="flex h-8 items-center gap-4">
			<span>Home</span>
			<Separator orientation="vertical" />
			<span>Products</span>
			<Separator orientation="vertical" />
			<span>About</span>
			<Separator orientation="vertical" />
			<span>Contact</span>
		</div>
	),
};

export const InCard: Story = {
	render: () => (
		<div className="w-80 rounded-lg border p-4">
			<h2 className="text-lg font-bold">Card Title</h2>
			<p className="text-sm text-gray-500">Card description goes here</p>
			<Separator className="my-4" />
			<div className="space-y-2">
				<p className="text-sm">Item 1</p>
				<p className="text-sm">Item 2</p>
				<p className="text-sm">Item 3</p>
			</div>
			<Separator className="my-4" />
			<div className="flex justify-end">
				<button type="button" className="text-sm text-blue-600">
					View More
				</button>
			</div>
		</div>
	),
};

export const InNavigation: Story = {
	render: () => (
		<nav className="flex items-center gap-2">
			<span className="px-3 py-2 hover:bg-gray-100 rounded cursor-pointer">Dashboard</span>
			<span className="px-3 py-2 hover:bg-gray-100 rounded cursor-pointer">Analytics</span>
			<Separator orientation="vertical" className="h-6" />
			<span className="px-3 py-2 hover:bg-gray-100 rounded cursor-pointer">Settings</span>
			<span className="px-3 py-2 hover:bg-gray-100 rounded cursor-pointer">Help</span>
		</nav>
	),
};
