import type { Meta, StoryObj } from "@storybook/react";

import { Header } from "react-aria-components";

import { Button } from "./button";
import { Menu } from "./menu";
import { Popover } from "./popover";

const meta: Meta<typeof Menu> = {
	title: "Overlays/Menu",
	component: Menu,
};

export default meta;
type Story = StoryObj<typeof Menu>;

export const Default: Story = {
	render: (args) => (
		<Menu.Trigger>
			<Button>Open Menu</Button>
			<Popover>
				<Menu {...args}>
					<Menu.Item>New File</Menu.Item>
					<Menu.Item>Open File</Menu.Item>
					<Menu.Item>Save</Menu.Item>
					<Menu.Item>Save As...</Menu.Item>
				</Menu>
			</Popover>
		</Menu.Trigger>
	),
};

export const PlacementTop: Story = {
	render: () => (
		<div className="flex h-48 items-end justify-center">
			<Menu.Trigger>
				<Button>Open Above</Button>
				<Popover placement="top">
					<Menu>
						<Menu.Item>Option 1</Menu.Item>
						<Menu.Item>Option 2</Menu.Item>
						<Menu.Item>Option 3</Menu.Item>
					</Menu>
				</Popover>
			</Menu.Trigger>
		</div>
	),
};

export const PlacementBottom: Story = {
	render: () => (
		<Menu.Trigger>
			<Button>Open Below</Button>
			<Popover placement="bottom">
				<Menu>
					<Menu.Item>Option 1</Menu.Item>
					<Menu.Item>Option 2</Menu.Item>
					<Menu.Item>Option 3</Menu.Item>
				</Menu>
			</Popover>
		</Menu.Trigger>
	),
};

export const PlacementLeft: Story = {
	render: () => (
		<div className="flex justify-end">
			<Menu.Trigger>
				<Button>Open Left</Button>
				<Popover placement="left">
					<Menu>
						<Menu.Item>Option 1</Menu.Item>
						<Menu.Item>Option 2</Menu.Item>
						<Menu.Item>Option 3</Menu.Item>
					</Menu>
				</Popover>
			</Menu.Trigger>
		</div>
	),
};

export const PlacementRight: Story = {
	render: () => (
		<Menu.Trigger>
			<Button>Open Right</Button>
			<Popover placement="right">
				<Menu>
					<Menu.Item>Option 1</Menu.Item>
					<Menu.Item>Option 2</Menu.Item>
					<Menu.Item>Option 3</Menu.Item>
				</Menu>
			</Popover>
		</Menu.Trigger>
	),
};

export const WithSections: Story = {
	render: () => (
		<Menu.Trigger>
			<Button>Edit</Button>
			<Popover>
				<Menu>
					<Menu.Section>
						<Header className="px-2 py-1 text-xs font-semibold text-gray-500">Edit</Header>
						<Menu.Item>Cut</Menu.Item>
						<Menu.Item>Copy</Menu.Item>
						<Menu.Item>Paste</Menu.Item>
					</Menu.Section>
					<Menu.Section>
						<Header className="px-2 py-1 text-xs font-semibold text-gray-500">Selection</Header>
						<Menu.Item>Select All</Menu.Item>
						<Menu.Item>Select None</Menu.Item>
					</Menu.Section>
				</Menu>
			</Popover>
		</Menu.Trigger>
	),
};

export const WithSeparators: Story = {
	render: () => (
		<Menu.Trigger>
			<Button>Actions</Button>
			<Popover>
				<Menu>
					<Menu.Item>New</Menu.Item>
					<Menu.Item>Open</Menu.Item>
					<Menu.Separator />
					<Menu.Item>Save</Menu.Item>
					<Menu.Item>Save As...</Menu.Item>
					<Menu.Separator />
					<Menu.Item>Export</Menu.Item>
				</Menu>
			</Popover>
		</Menu.Trigger>
	),
};

export const WithDangerItem: Story = {
	render: () => (
		<Menu.Trigger>
			<Button>More Actions</Button>
			<Popover>
				<Menu>
					<Menu.Item>Edit</Menu.Item>
					<Menu.Item>Duplicate</Menu.Item>
					<Menu.Item>Archive</Menu.Item>
					<Menu.Separator />
					<Menu.Item danger>Delete</Menu.Item>
				</Menu>
			</Popover>
		</Menu.Trigger>
	),
};

export const WithDisabledItems: Story = {
	render: () => (
		<Menu.Trigger>
			<Button>File</Button>
			<Popover>
				<Menu disabledKeys={["save", "undo"]}>
					<Menu.Item id="new">New</Menu.Item>
					<Menu.Item id="open">Open</Menu.Item>
					<Menu.Item id="save">Save</Menu.Item>
					<Menu.Separator />
					<Menu.Item id="undo">Undo</Menu.Item>
					<Menu.Item id="redo">Redo</Menu.Item>
				</Menu>
			</Popover>
		</Menu.Trigger>
	),
};

export const WithSubmenu: Story = {
	render: () => (
		<Menu.Trigger>
			<Button>View</Button>
			<Popover>
				<Menu>
					<Menu.Item>Zoom In</Menu.Item>
					<Menu.Item>Zoom Out</Menu.Item>
					<Menu.Separator />
					<Menu.SubmenuTrigger>
						<Menu.Item>Appearance</Menu.Item>
						<Popover>
							<Menu>
								<Menu.Item>Light</Menu.Item>
								<Menu.Item>Dark</Menu.Item>
								<Menu.Item>System</Menu.Item>
							</Menu>
						</Popover>
					</Menu.SubmenuTrigger>
					<Menu.SubmenuTrigger>
						<Menu.Item>Layout</Menu.Item>
						<Popover>
							<Menu>
								<Menu.Item>Grid</Menu.Item>
								<Menu.Item>List</Menu.Item>
								<Menu.Item>Compact</Menu.Item>
							</Menu>
						</Popover>
					</Menu.SubmenuTrigger>
				</Menu>
			</Popover>
		</Menu.Trigger>
	),
};

export const NestedSubmenus: Story = {
	render: () => (
		<Menu.Trigger>
			<Button>Insert</Button>
			<Popover>
				<Menu>
					<Menu.Item>Text</Menu.Item>
					<Menu.Item>Image</Menu.Item>
					<Menu.SubmenuTrigger>
						<Menu.Item>Shape</Menu.Item>
						<Popover>
							<Menu>
								<Menu.Item>Rectangle</Menu.Item>
								<Menu.Item>Circle</Menu.Item>
								<Menu.SubmenuTrigger>
									<Menu.Item>Arrows</Menu.Item>
									<Popover>
										<Menu>
											<Menu.Item>Right Arrow</Menu.Item>
											<Menu.Item>Left Arrow</Menu.Item>
											<Menu.Item>Up Arrow</Menu.Item>
											<Menu.Item>Down Arrow</Menu.Item>
										</Menu>
									</Popover>
								</Menu.SubmenuTrigger>
								<Menu.Item>Triangle</Menu.Item>
							</Menu>
						</Popover>
					</Menu.SubmenuTrigger>
					<Menu.Item>Table</Menu.Item>
				</Menu>
			</Popover>
		</Menu.Trigger>
	),
};

export const WithSelectionSingle: Story = {
	render: () => (
		<Menu.Trigger>
			<Button>Sort By</Button>
			<Popover>
				<Menu selectionMode="single" defaultSelectedKeys={["name"]}>
					<Menu.Item id="name">Name</Menu.Item>
					<Menu.Item id="date">Date Modified</Menu.Item>
					<Menu.Item id="size">Size</Menu.Item>
					<Menu.Item id="type">Type</Menu.Item>
				</Menu>
			</Popover>
		</Menu.Trigger>
	),
};

export const WithSelectionMultiple: Story = {
	render: () => (
		<Menu.Trigger>
			<Button>Show Columns</Button>
			<Popover>
				<Menu selectionMode="multiple" defaultSelectedKeys={["name", "date"]}>
					<Menu.Item id="name">Name</Menu.Item>
					<Menu.Item id="date">Date</Menu.Item>
					<Menu.Item id="size">Size</Menu.Item>
					<Menu.Item id="type">Type</Menu.Item>
					<Menu.Item id="owner">Owner</Menu.Item>
				</Menu>
			</Popover>
		</Menu.Trigger>
	),
};

export const ContextMenu: Story = {
	render: () => (
		<Menu.Trigger trigger="contextMenu">
			<Button variant="outline">Right Click Target</Button>
			<Popover>
				<Menu>
					<Menu.Item>Cut</Menu.Item>
					<Menu.Item>Copy</Menu.Item>
					<Menu.Item>Paste</Menu.Item>
					<Menu.Separator />
					<Menu.Item>Rename</Menu.Item>
					<Menu.Item danger>Delete</Menu.Item>
				</Menu>
			</Popover>
		</Menu.Trigger>
	),
};
