import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "./button";
import { Separator } from "./separator";
import { ToggleButton, ToggleButtonGroup } from "./toggle-button";
import { Toolbar } from "./toolbar";

const meta: Meta<typeof Toolbar> = {
	title: "Layout/Toolbar",
	component: Toolbar,
	args: {
		orientation: "horizontal",
	},
	argTypes: {
		orientation: { control: "select", options: ["horizontal", "vertical"] },
	},
};

export default meta;
type Story = StoryObj<typeof Toolbar>;

export const Default: Story = {
	render: (args) => (
		<Toolbar {...args} className="flex gap-2">
			<Button variant="ghost" size="sm">
				Cut
			</Button>
			<Button variant="ghost" size="sm">
				Copy
			</Button>
			<Button variant="ghost" size="sm">
				Paste
			</Button>
		</Toolbar>
	),
};

export const WithSeparators: Story = {
	render: () => (
		<Toolbar className="flex items-center gap-2">
			<Button variant="ghost" size="sm">
				New
			</Button>
			<Button variant="ghost" size="sm">
				Open
			</Button>
			<Button variant="ghost" size="sm">
				Save
			</Button>
			<Separator orientation="vertical" className="h-6" />
			<Button variant="ghost" size="sm">
				Undo
			</Button>
			<Button variant="ghost" size="sm">
				Redo
			</Button>
			<Separator orientation="vertical" className="h-6" />
			<Button variant="ghost" size="sm">
				Settings
			</Button>
		</Toolbar>
	),
};

export const TextEditor: Story = {
	render: () => (
		<Toolbar className="flex items-center gap-1 rounded border p-1">
			<ToggleButtonGroup selectionMode="multiple">
				<ToggleButton id="bold" variant="ghost" size="sm">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
						<path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
					</svg>
				</ToggleButton>
				<ToggleButton id="italic" variant="ghost" size="sm">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<line x1="19" x2="10" y1="4" y2="4" />
						<line x1="14" x2="5" y1="20" y2="20" />
						<line x1="15" x2="9" y1="4" y2="20" />
					</svg>
				</ToggleButton>
				<ToggleButton id="underline" variant="ghost" size="sm">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M6 4v6a6 6 0 0 0 12 0V4" />
						<line x1="4" x2="20" y1="20" y2="20" />
					</svg>
				</ToggleButton>
			</ToggleButtonGroup>
			<Separator orientation="vertical" className="h-6" />
			<ToggleButtonGroup selectionMode="single">
				<ToggleButton id="left" variant="ghost" size="sm">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<line x1="21" x2="3" y1="6" y2="6" />
						<line x1="15" x2="3" y1="12" y2="12" />
						<line x1="17" x2="3" y1="18" y2="18" />
					</svg>
				</ToggleButton>
				<ToggleButton id="center" variant="ghost" size="sm">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<line x1="21" x2="3" y1="6" y2="6" />
						<line x1="17" x2="7" y1="12" y2="12" />
						<line x1="19" x2="5" y1="18" y2="18" />
					</svg>
				</ToggleButton>
				<ToggleButton id="right" variant="ghost" size="sm">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<line x1="21" x2="3" y1="6" y2="6" />
						<line x1="21" x2="9" y1="12" y2="12" />
						<line x1="21" x2="7" y1="18" y2="18" />
					</svg>
				</ToggleButton>
			</ToggleButtonGroup>
			<Separator orientation="vertical" className="h-6" />
			<Button variant="ghost" size="sm">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
					<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
				</svg>
			</Button>
			<Button variant="ghost" size="sm">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
					<circle cx="9" cy="9" r="2" />
					<path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
				</svg>
			</Button>
		</Toolbar>
	),
};

export const VerticalToolbar: Story = {
	render: () => (
		<Toolbar orientation="vertical" className="flex flex-col gap-1 rounded border p-1 w-fit">
			<Button variant="ghost" size="sm">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
				</svg>
			</Button>
			<Button variant="ghost" size="sm">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<path d="M3 6h18" />
					<path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
					<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
				</svg>
			</Button>
			<Separator orientation="horizontal" className="w-full" />
			<Button variant="ghost" size="sm">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
					<polyline points="7 10 12 15 17 10" />
					<line x1="12" x2="12" y1="15" y2="3" />
				</svg>
			</Button>
			<Button variant="ghost" size="sm">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<circle cx="11" cy="11" r="8" />
					<path d="m21 21-4.3-4.3" />
				</svg>
			</Button>
		</Toolbar>
	),
};

export const ActionBar: Story = {
	render: () => (
		<Toolbar className="flex items-center justify-between rounded border p-2">
			<div className="flex gap-2">
				<Button size="sm">Save</Button>
				<Button variant="outline" size="sm">
					Preview
				</Button>
			</div>
			<div className="flex gap-2">
				<Button variant="ghost" size="sm" color="danger">
					Delete
				</Button>
			</div>
		</Toolbar>
	),
};
