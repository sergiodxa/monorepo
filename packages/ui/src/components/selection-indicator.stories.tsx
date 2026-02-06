import type { Meta, StoryObj } from "@storybook/react";

import { ListBox } from "./listbox";
import { SelectionIndicator } from "./selection-indicator";

const meta: Meta<typeof SelectionIndicator> = {
	title: "Utility/SelectionIndicator",
	component: SelectionIndicator,
};

export default meta;
type Story = StoryObj<typeof SelectionIndicator>;

export const Default: Story = {
	render: (args) => (
		<ListBox
			aria-label="Theme selection"
			selectionMode="single"
			defaultSelectedKeys={["light"]}
			className="w-56"
		>
			<ListBox.Item id="light" textValue="Light Mode">
				<SelectionIndicator {...args} slot="selection" />
				<span>Light Mode</span>
			</ListBox.Item>
			<ListBox.Item id="dark" textValue="Dark Mode">
				<SelectionIndicator {...args} slot="selection" />
				<span>Dark Mode</span>
			</ListBox.Item>
			<ListBox.Item id="system" textValue="System">
				<SelectionIndicator {...args} slot="selection" />
				<span>System</span>
			</ListBox.Item>
		</ListBox>
	),
};

export const UsageExample: Story = {
	render: () => (
		<div className="max-w-md rounded-lg border border-gray-200 bg-gray-50 p-4">
			<h3 className="mb-4 font-semibold">SelectionIndicator Usage</h3>
			<p className="mb-4 text-sm text-gray-600">
				The SelectionIndicator component is used within Menu or ListBox items to show which items
				are currently selected.
			</p>
			<pre className="overflow-x-auto rounded bg-gray-900 p-4 text-sm text-gray-100">
				{`<Menu selectionMode="single">
  <Menu.Item id="opt1">
    <SelectionIndicator />
    <Text slot="label">Option 1</Text>
  </Menu.Item>
  <Menu.Item id="opt2">
    <SelectionIndicator />
    <Text slot="label">Option 2</Text>
  </Menu.Item>
</Menu>`}
			</pre>
		</div>
	),
};

export const VisualRepresentation: Story = {
	render: () => (
		<div className="flex flex-col gap-4">
			<p className="text-sm text-gray-600">
				Visual representation of selection indicators in a menu:
			</p>
			<div className="w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
				<div className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-gray-100">
					<span className="w-4 text-blue-600">
						<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M5 13l4 4L19 7"
							/>
						</svg>
					</span>
					<span>Light Mode</span>
				</div>
				<div className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-gray-100">
					<span className="w-4" />
					<span>Dark Mode</span>
				</div>
				<div className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-gray-100">
					<span className="w-4" />
					<span>System</span>
				</div>
			</div>
		</div>
	),
};

export const MultipleSelection: Story = {
	render: () => (
		<div className="flex flex-col gap-4">
			<p className="text-sm text-gray-600">Multiple selection mode with several items selected:</p>
			<div className="w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
				<div className="flex cursor-pointer items-center gap-2 bg-blue-50 px-3 py-2 hover:bg-blue-100">
					<span className="w-4 text-blue-600">
						<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M5 13l4 4L19 7"
							/>
						</svg>
					</span>
					<span>Apple</span>
				</div>
				<div className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-gray-100">
					<span className="w-4" />
					<span>Banana</span>
				</div>
				<div className="flex cursor-pointer items-center gap-2 bg-blue-50 px-3 py-2 hover:bg-blue-100">
					<span className="w-4 text-blue-600">
						<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M5 13l4 4L19 7"
							/>
						</svg>
					</span>
					<span>Cherry</span>
				</div>
				<div className="flex cursor-pointer items-center gap-2 bg-blue-50 px-3 py-2 hover:bg-blue-100">
					<span className="w-4 text-blue-600">
						<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M5 13l4 4L19 7"
							/>
						</svg>
					</span>
					<span>Date</span>
				</div>
			</div>
		</div>
	),
};
