import type { Meta, StoryObj } from "@storybook/react";

import { Card } from "./card";
import { ContextMenu } from "./context-menu";
import { Text } from "./text";

const meta: Meta<typeof ContextMenu> = {
	title: "Overlays/ContextMenu",
	component: ContextMenu,
};

export default meta;
type Story = StoryObj<typeof ContextMenu>;

export const Default: Story = {
	render: () => (
		<ContextMenu>
			<ContextMenu.Trigger>
				<Card>
					<Card.Header>
						<Card.Title>Workspace</Card.Title>
						<Card.Description>Right click to open the menu.</Card.Description>
					</Card.Header>
					<Card.Content>
						<Text>Actions are available from the context menu.</Text>
					</Card.Content>
				</Card>
			</ContextMenu.Trigger>
			<ContextMenu.Content>
				<ContextMenu.Item>New File</ContextMenu.Item>
				<ContextMenu.Item>
					Rename
					<ContextMenu.Shortcut>F2</ContextMenu.Shortcut>
				</ContextMenu.Item>
				<ContextMenu.Item>Duplicate</ContextMenu.Item>
				<ContextMenu.Separator />
				<ContextMenu.Group>
					<ContextMenu.Label>Share</ContextMenu.Label>
					<ContextMenu.Item>Copy Link</ContextMenu.Item>
					<ContextMenu.Item>Invite Teammate</ContextMenu.Item>
				</ContextMenu.Group>
				<ContextMenu.Separator />
				<ContextMenu.Item danger>Delete</ContextMenu.Item>
			</ContextMenu.Content>
		</ContextMenu>
	),
};

export const WithSubmenu: Story = {
	render: () => (
		<ContextMenu>
			<ContextMenu.Trigger>
				<Card>
					<Card.Header>
						<Card.Title>Board</Card.Title>
						<Card.Description>Right click for view options.</Card.Description>
					</Card.Header>
					<Card.Content>
						<Text>Try switching between layouts.</Text>
					</Card.Content>
				</Card>
			</ContextMenu.Trigger>
			<ContextMenu.Content>
				<ContextMenu.Item>Open</ContextMenu.Item>
				<ContextMenu.Item>Favorite</ContextMenu.Item>
				<ContextMenu.Sub>
					<ContextMenu.SubTrigger>View</ContextMenu.SubTrigger>
					<ContextMenu.SubContent>
						<ContextMenu.Item>Kanban</ContextMenu.Item>
						<ContextMenu.Item>List</ContextMenu.Item>
						<ContextMenu.Item>Timeline</ContextMenu.Item>
					</ContextMenu.SubContent>
				</ContextMenu.Sub>
				<ContextMenu.Separator />
				<ContextMenu.Item danger>Archive</ContextMenu.Item>
			</ContextMenu.Content>
		</ContextMenu>
	),
};
