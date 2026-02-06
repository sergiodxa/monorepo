import type { Meta, StoryObj } from "@storybook/react";

import { Keyboard } from "./keyboard";

const meta: Meta<typeof Keyboard> = {
	title: "Utility/Keyboard",
	component: Keyboard,
};

export default meta;
type Story = StoryObj<typeof Keyboard>;

export const Default: Story = {
	render: (args) => (
		<Keyboard
			{...args}
			className="rounded border border-gray-300 bg-gray-100 px-2 py-1 font-mono text-sm"
		>
			Ctrl
		</Keyboard>
	),
};

export const CommonShortcuts: Story = {
	render: () => (
		<div className="flex flex-col gap-3">
			<div className="flex items-center justify-between">
				<span>Save</span>
				<span className="flex gap-1">
					<Keyboard className="rounded border border-gray-300 bg-gray-100 px-2 py-0.5 font-mono text-sm">
						Ctrl
					</Keyboard>
					<Keyboard className="rounded border border-gray-300 bg-gray-100 px-2 py-0.5 font-mono text-sm">
						S
					</Keyboard>
				</span>
			</div>
			<div className="flex items-center justify-between">
				<span>Copy</span>
				<span className="flex gap-1">
					<Keyboard className="rounded border border-gray-300 bg-gray-100 px-2 py-0.5 font-mono text-sm">
						Ctrl
					</Keyboard>
					<Keyboard className="rounded border border-gray-300 bg-gray-100 px-2 py-0.5 font-mono text-sm">
						C
					</Keyboard>
				</span>
			</div>
			<div className="flex items-center justify-between">
				<span>Paste</span>
				<span className="flex gap-1">
					<Keyboard className="rounded border border-gray-300 bg-gray-100 px-2 py-0.5 font-mono text-sm">
						Ctrl
					</Keyboard>
					<Keyboard className="rounded border border-gray-300 bg-gray-100 px-2 py-0.5 font-mono text-sm">
						V
					</Keyboard>
				</span>
			</div>
			<div className="flex items-center justify-between">
				<span>Undo</span>
				<span className="flex gap-1">
					<Keyboard className="rounded border border-gray-300 bg-gray-100 px-2 py-0.5 font-mono text-sm">
						Ctrl
					</Keyboard>
					<Keyboard className="rounded border border-gray-300 bg-gray-100 px-2 py-0.5 font-mono text-sm">
						Z
					</Keyboard>
				</span>
			</div>
		</div>
	),
};

export const MacShortcuts: Story = {
	render: () => (
		<div className="flex flex-col gap-3">
			<div className="flex items-center justify-between">
				<span>Save</span>
				<span className="flex gap-1">
					<Keyboard className="rounded border border-gray-300 bg-gray-100 px-2 py-0.5 font-mono text-sm">
						&#8984;
					</Keyboard>
					<Keyboard className="rounded border border-gray-300 bg-gray-100 px-2 py-0.5 font-mono text-sm">
						S
					</Keyboard>
				</span>
			</div>
			<div className="flex items-center justify-between">
				<span>Search</span>
				<span className="flex gap-1">
					<Keyboard className="rounded border border-gray-300 bg-gray-100 px-2 py-0.5 font-mono text-sm">
						&#8984;
					</Keyboard>
					<Keyboard className="rounded border border-gray-300 bg-gray-100 px-2 py-0.5 font-mono text-sm">
						K
					</Keyboard>
				</span>
			</div>
			<div className="flex items-center justify-between">
				<span>Toggle Sidebar</span>
				<span className="flex gap-1">
					<Keyboard className="rounded border border-gray-300 bg-gray-100 px-2 py-0.5 font-mono text-sm">
						&#8984;
					</Keyboard>
					<Keyboard className="rounded border border-gray-300 bg-gray-100 px-2 py-0.5 font-mono text-sm">
						B
					</Keyboard>
				</span>
			</div>
		</div>
	),
};

export const InMenuItem: Story = {
	render: () => (
		<div className="w-64 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
			<div className="flex cursor-pointer items-center justify-between px-4 py-2 hover:bg-gray-100">
				<span>New File</span>
				<span className="flex gap-1">
					<Keyboard className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-500">
						Ctrl
					</Keyboard>
					<Keyboard className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-500">
						N
					</Keyboard>
				</span>
			</div>
			<div className="flex cursor-pointer items-center justify-between px-4 py-2 hover:bg-gray-100">
				<span>Open File</span>
				<span className="flex gap-1">
					<Keyboard className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-500">
						Ctrl
					</Keyboard>
					<Keyboard className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-500">
						O
					</Keyboard>
				</span>
			</div>
			<div className="flex cursor-pointer items-center justify-between px-4 py-2 hover:bg-gray-100">
				<span>Save</span>
				<span className="flex gap-1">
					<Keyboard className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-500">
						Ctrl
					</Keyboard>
					<Keyboard className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-500">
						S
					</Keyboard>
				</span>
			</div>
			<div className="my-1 border-t border-gray-200" />
			<div className="flex cursor-pointer items-center justify-between px-4 py-2 hover:bg-gray-100">
				<span>Close</span>
				<span className="flex gap-1">
					<Keyboard className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-500">
						Ctrl
					</Keyboard>
					<Keyboard className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-500">
						W
					</Keyboard>
				</span>
			</div>
		</div>
	),
};

export const SpecialKeys: Story = {
	render: () => (
		<div className="flex flex-wrap gap-2">
			<Keyboard className="rounded border border-gray-300 bg-gray-100 px-2 py-1 font-mono text-sm">
				Enter
			</Keyboard>
			<Keyboard className="rounded border border-gray-300 bg-gray-100 px-2 py-1 font-mono text-sm">
				Tab
			</Keyboard>
			<Keyboard className="rounded border border-gray-300 bg-gray-100 px-2 py-1 font-mono text-sm">
				Shift
			</Keyboard>
			<Keyboard className="rounded border border-gray-300 bg-gray-100 px-2 py-1 font-mono text-sm">
				Esc
			</Keyboard>
			<Keyboard className="rounded border border-gray-300 bg-gray-100 px-2 py-1 font-mono text-sm">
				Space
			</Keyboard>
			<Keyboard className="rounded border border-gray-300 bg-gray-100 px-2 py-1 font-mono text-sm">
				Backspace
			</Keyboard>
			<Keyboard className="rounded border border-gray-300 bg-gray-100 px-2 py-1 font-mono text-sm">
				Delete
			</Keyboard>
		</div>
	),
};

export const ArrowKeys: Story = {
	render: () => (
		<div className="flex flex-col items-center gap-1">
			<Keyboard className="rounded border border-gray-300 bg-gray-100 px-3 py-1 font-mono text-sm">
				&#8593;
			</Keyboard>
			<div className="flex gap-1">
				<Keyboard className="rounded border border-gray-300 bg-gray-100 px-3 py-1 font-mono text-sm">
					&#8592;
				</Keyboard>
				<Keyboard className="rounded border border-gray-300 bg-gray-100 px-3 py-1 font-mono text-sm">
					&#8595;
				</Keyboard>
				<Keyboard className="rounded border border-gray-300 bg-gray-100 px-3 py-1 font-mono text-sm">
					&#8594;
				</Keyboard>
			</div>
		</div>
	),
};
