import type { Meta, StoryObj } from "@storybook/react";

import { Header } from "./header";

const meta: Meta<typeof Header> = {
	title: "Utility/Header",
	component: Header,
};

export default meta;
type Story = StoryObj<typeof Header>;

export const Default: Story = {
	render: (args) => (
		<Header {...args} className="border-b border-gray-200 bg-gray-50 px-4 py-2 font-semibold">
			Section Header
		</Header>
	),
};

export const InListContext: Story = {
	render: () => (
		<div className="w-64 rounded-lg border border-gray-200">
			<Header className="border-b border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
				Categories
			</Header>
			<ul className="divide-y divide-gray-100">
				<li className="px-4 py-2">Electronics</li>
				<li className="px-4 py-2">Clothing</li>
				<li className="px-4 py-2">Books</li>
			</ul>
		</div>
	),
};

export const InMenuContext: Story = {
	render: () => (
		<div className="w-56 rounded-lg border border-gray-200 bg-white shadow-lg">
			<Header className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
				Account
			</Header>
			<div className="py-1">
				<div className="cursor-pointer px-3 py-2 hover:bg-gray-100">Profile</div>
				<div className="cursor-pointer px-3 py-2 hover:bg-gray-100">Settings</div>
			</div>
			<Header className="border-t border-gray-200 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
				Actions
			</Header>
			<div className="py-1">
				<div className="cursor-pointer px-3 py-2 hover:bg-gray-100">Sign out</div>
			</div>
		</div>
	),
};

export const WithIcon: Story = {
	render: () => (
		<Header className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2">
			<svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={2}
					d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
				/>
			</svg>
			<span className="font-semibold">Inbox</span>
		</Header>
	),
};
