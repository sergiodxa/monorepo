import type { Meta, StoryObj } from "@storybook/react";

import { useState } from "react";
import { useDragAndDrop } from "react-aria-components";

import { Checkbox } from "./checkbox";
import { GridList } from "./grid-list";

const meta: Meta<typeof GridList> = {
	title: "Collections/GridList",
	component: GridList,
	args: {
		selectionMode: "none",
	},
	argTypes: {
		selectionMode: { control: "select", options: ["none", "single", "multiple"] },
	},
};

export default meta;
type Story = StoryObj<typeof GridList>;

interface FileItem {
	id: number;
	name: string;
	type: "folder" | "document" | "image" | "video";
	size?: string;
}

const files: FileItem[] = [
	{ id: 1, name: "Documents", type: "folder" },
	{ id: 2, name: "Photos", type: "folder" },
	{ id: 3, name: "Report.pdf", type: "document", size: "2.4 MB" },
	{ id: 4, name: "Presentation.pptx", type: "document", size: "5.1 MB" },
	{ id: 5, name: "vacation.jpg", type: "image", size: "3.2 MB" },
	{ id: 6, name: "screenshot.png", type: "image", size: "856 KB" },
	{ id: 7, name: "tutorial.mp4", type: "video", size: "45.2 MB" },
];

export const Default: Story = {
	render: (args) => (
		<GridList aria-label="Files" {...args}>
			{files.map((file) => (
				<GridList.Item key={file.id} textValue={file.name}>
					<span>{file.name}</span>
					{file.size && <span className="ml-2 text-sm text-neutral-500">{file.size}</span>}
				</GridList.Item>
			))}
		</GridList>
	),
};

export const SingleSelection: Story = {
	render: () => (
		<GridList aria-label="Files" selectionMode="single">
			{files.map((file) => (
				<GridList.Item key={file.id} textValue={file.name}>
					{file.name}
				</GridList.Item>
			))}
		</GridList>
	),
};

export const MultipleSelection: Story = {
	render: () => (
		<GridList aria-label="Files" selectionMode="multiple">
			{files.map((file) => (
				<GridList.Item key={file.id} textValue={file.name}>
					<Checkbox slot="selection" />
					<span>{file.name}</span>
				</GridList.Item>
			))}
		</GridList>
	),
};

export const WithSections: Story = {
	render: () => (
		<GridList aria-label="Files">
			<GridList.Section>
				<GridList.Header>Folders</GridList.Header>
				{files
					.filter((f) => f.type === "folder")
					.map((file) => (
						<GridList.Item key={file.id} textValue={file.name}>
							{file.name}
						</GridList.Item>
					))}
			</GridList.Section>
			<GridList.Section>
				<GridList.Header>Documents</GridList.Header>
				{files
					.filter((f) => f.type === "document")
					.map((file) => (
						<GridList.Item key={file.id} textValue={file.name}>
							{file.name}
						</GridList.Item>
					))}
			</GridList.Section>
			<GridList.Section>
				<GridList.Header>Media</GridList.Header>
				{files
					.filter((f) => f.type === "image" || f.type === "video")
					.map((file) => (
						<GridList.Item key={file.id} textValue={file.name}>
							{file.name}
						</GridList.Item>
					))}
			</GridList.Section>
		</GridList>
	),
};

export const WithDragAndDrop: Story = {
	render: function DraggableGridList() {
		let [items, setItems] = useState(files);

		let { dragAndDropHooks } = useDragAndDrop({
			getItems: (keys) =>
				[...keys].map((key) => ({
					"text/plain": items.find((item) => item.id === key)?.name ?? "",
				})),
			onReorder(e) {
				let targetIndex = items.findIndex((item) => item.id === e.target.key);
				let movedItems = [...e.keys]
					.map((key) => items.find((item) => item.id === key))
					.filter((item): item is FileItem => item !== undefined);

				let newItems = items.filter((item) => !e.keys.has(item.id));

				if (e.target.dropPosition === "before") {
					newItems.splice(targetIndex, 0, ...movedItems);
				} else if (e.target.dropPosition === "after") {
					newItems.splice(targetIndex + 1, 0, ...movedItems);
				}

				setItems(newItems);
			},
		});

		return (
			<GridList
				aria-label="Reorderable files"
				selectionMode="multiple"
				items={items}
				dragAndDropHooks={dragAndDropHooks}
			>
				{(item) => (
					<GridList.Item id={item.id} textValue={item.name}>
						<GridList.DragHandle />
						<Checkbox slot="selection" />
						<span>{item.name}</span>
					</GridList.Item>
				)}
			</GridList>
		);
	},
};

export const DisabledItems: Story = {
	render: () => (
		<GridList aria-label="Files" selectionMode="multiple" disabledKeys={[3, 5]}>
			{files.map((file) => (
				<GridList.Item key={file.id} textValue={file.name}>
					<Checkbox slot="selection" />
					<span>{file.name}</span>
				</GridList.Item>
			))}
		</GridList>
	),
};

export const Empty: Story = {
	render: () => (
		<GridList aria-label="Empty list" renderEmptyState={() => <span>No files found</span>}>
			{[]}
		</GridList>
	),
};
