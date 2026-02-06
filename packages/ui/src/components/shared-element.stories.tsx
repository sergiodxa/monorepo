import type { Meta, StoryObj } from "@storybook/react";

import { SharedElement } from "./shared-element";

const meta: Meta<typeof SharedElement> = {
	title: "Utility/SharedElement",
	component: SharedElement,
};

export default meta;
type Story = StoryObj<typeof SharedElement>;

export const Default: Story = {
	render: (args) => (
		<div className="flex flex-col gap-2 rounded-lg border border-gray-200 p-4">
			<p className="text-sm text-gray-500">
				SharedElement enables view transitions between elements with matching names across different
				pages or states.
			</p>
			<SharedElement {...args} name="demo-element" className="inline-block">
				<div className="h-24 w-24 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600" />
			</SharedElement>
		</div>
	),
};

export const UsageExample: Story = {
	render: () => (
		<div className="max-w-lg rounded-lg border border-gray-200 bg-gray-50 p-4">
			<h3 className="mb-4 font-semibold">SharedElement Usage</h3>
			<p className="mb-4 text-sm text-gray-600">
				SharedElement wraps content that should animate smoothly during view transitions. Elements
				with the same name across pages will morph into each other during navigation.
			</p>
			<pre className="overflow-x-auto rounded bg-gray-900 p-4 text-sm text-gray-100">
				{`// Page 1 - List view
<SharedElement name="hero-image">
  <img
    src="/product.jpg"
    className="h-20 w-20 rounded"
  />
</SharedElement>

// Page 2 - Detail view
<SharedElement name="hero-image">
  <img
    src="/product.jpg"
    className="h-64 w-full rounded-lg"
  />
</SharedElement>`}
			</pre>
		</div>
	),
};

export const CardTransition: Story = {
	render: () => (
		<div className="flex flex-col gap-6">
			<p className="text-sm text-gray-600">
				Example of shared elements in a card-to-detail transition:
			</p>

			<div className="flex gap-8">
				<div className="flex flex-col gap-2">
					<p className="text-xs font-medium text-gray-500">LIST VIEW</p>
					<div className="w-48 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
						<SharedElement name="card-image" className="block">
							<div className="mb-2 h-24 rounded bg-gradient-to-br from-orange-400 to-pink-500" />
						</SharedElement>
						<SharedElement name="card-title" className="block">
							<h4 className="font-semibold">Product Name</h4>
						</SharedElement>
						<p className="text-sm text-gray-500">$99.00</p>
					</div>
				</div>

				<div className="flex items-center text-gray-400">
					<svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M14 5l7 7m0 0l-7 7m7-7H3"
						/>
					</svg>
				</div>

				<div className="flex flex-col gap-2">
					<p className="text-xs font-medium text-gray-500">DETAIL VIEW</p>
					<div className="w-72 rounded-lg border border-gray-200 bg-white shadow-sm">
						<SharedElement name="card-image" className="block">
							<div className="h-48 rounded-t-lg bg-gradient-to-br from-orange-400 to-pink-500" />
						</SharedElement>
						<div className="p-4">
							<SharedElement name="card-title" className="block">
								<h4 className="text-xl font-semibold">Product Name</h4>
							</SharedElement>
							<p className="mt-1 text-lg font-medium text-gray-900">$99.00</p>
							<p className="mt-2 text-sm text-gray-600">
								This is a detailed description of the product that appears on the detail page.
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	),
};

export const AvatarTransition: Story = {
	render: () => (
		<div className="flex flex-col gap-6">
			<p className="text-sm text-gray-600">
				Example of shared avatar element transitioning from header to profile:
			</p>

			<div className="flex gap-8">
				<div className="flex flex-col gap-2">
					<p className="text-xs font-medium text-gray-500">HEADER</p>
					<div className="flex w-64 items-center justify-between rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
						<span className="font-medium">My App</span>
						<SharedElement name="user-avatar" className="block">
							<div className="h-8 w-8 rounded-full bg-gradient-to-br from-green-400 to-blue-500" />
						</SharedElement>
					</div>
				</div>

				<div className="flex items-center text-gray-400">
					<svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M14 5l7 7m0 0l-7 7m7-7H3"
						/>
					</svg>
				</div>

				<div className="flex flex-col gap-2">
					<p className="text-xs font-medium text-gray-500">PROFILE PAGE</p>
					<div className="w-64 rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm">
						<SharedElement name="user-avatar" className="mx-auto block w-fit">
							<div className="h-24 w-24 rounded-full bg-gradient-to-br from-green-400 to-blue-500" />
						</SharedElement>
						<h3 className="mt-4 text-xl font-semibold">John Doe</h3>
						<p className="text-sm text-gray-500">john@example.com</p>
					</div>
				</div>
			</div>
		</div>
	),
};
