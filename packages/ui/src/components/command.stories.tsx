import type { Meta, StoryObj } from "@storybook/react";

import { Command } from "./command";

const meta: Meta<typeof Command> = {
	title: "Overlays/Command",
	component: Command,
};

export default meta;
type Story = StoryObj<typeof Command>;

export const Default: Story = {
	render: (args) => (
		<Command {...args}>
			<Command.Input
				aria-label="Search commands"
				inputProps={{ placeholder: "Search commands..." }}
			/>
			<Command.List aria-label="Suggestions" selectionMode="single">
				<Command.Item id="new">New file</Command.Item>
				<Command.Item id="open">Open file</Command.Item>
				<Command.Item id="duplicate">Duplicate selection</Command.Item>
				<Command.Item id="settings">Open settings</Command.Item>
			</Command.List>
		</Command>
	),
};

export const EmptyState: Story = {
	render: (args) => (
		<Command {...args}>
			<Command.Input
				aria-label="Search commands"
				inputProps={{ placeholder: "Search commands..." }}
			/>
			<Command.List
				aria-label="Suggestions"
				selectionMode="single"
				renderEmptyState={() => <Command.Empty>No results found.</Command.Empty>}
			>
				{[]}
			</Command.List>
		</Command>
	),
};
