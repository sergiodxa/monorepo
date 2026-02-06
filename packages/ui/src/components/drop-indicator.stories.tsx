import type { Meta, StoryObj } from "@storybook/react";

import { useState } from "react";
import { useDragAndDrop } from "react-aria-components";

import { DropIndicator } from "./drop-indicator";
import { GridList } from "./grid-list";

const meta: Meta<typeof DropIndicator> = {
	title: "Utility/DropIndicator",
	component: DropIndicator,
};

export default meta;
type Story = StoryObj<typeof DropIndicator>;

interface TaskItem {
	id: number;
	name: string;
}

const tasks: TaskItem[] = [
	{ id: 1, name: "Draft proposal" },
	{ id: 2, name: "Review assets" },
	{ id: 3, name: "Schedule kickoff" },
	{ id: 4, name: "Share notes" },
];

export const Default: Story = {
	render: function Render(args) {
		let [items, setItems] = useState(tasks);

		let { dragAndDropHooks } = useDragAndDrop({
			getItems: (keys) =>
				[...keys].map((key) => ({
					"text/plain": items.find((item) => item.id === key)?.name ?? "",
				})),
			onReorder(e) {
				let targetIndex = items.findIndex((item) => item.id === e.target.key);
				let movedItems = [...e.keys]
					.map((key) => items.find((item) => item.id === key))
					.filter((item): item is TaskItem => item !== undefined);

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
			<div className="flex flex-col gap-2 rounded-lg border border-gray-200 p-4">
				<p className="text-sm text-gray-500">
					DropIndicator is used within drag-and-drop enabled lists to show where items will be
					dropped. Drag an item to see the indicator.
				</p>
				<GridList
					aria-label="Reorderable tasks"
					selectionMode="multiple"
					items={items}
					dragAndDropHooks={dragAndDropHooks}
					className="rounded-lg"
				>
					{(item) => (
						<>
							<DropIndicator
								{...args}
								target={{ type: "item", key: item.id, dropPosition: "before" }}
							/>
							<GridList.Item id={item.id} textValue={item.name}>
								{item.name}
							</GridList.Item>
						</>
					)}
				</GridList>
			</div>
		);
	},
};

export const UsageExample: Story = {
	render: () => (
		<div className="max-w-md rounded-lg border border-gray-200 bg-gray-50 p-4">
			<h3 className="mb-4 font-semibold">DropIndicator Usage</h3>
			<p className="mb-4 text-sm text-gray-600">
				The DropIndicator component is used within GridList or other drag-and-drop enabled
				components. It renders a visual indicator showing where dropped items will be inserted.
			</p>
			<pre className="overflow-x-auto rounded bg-gray-900 p-4 text-sm text-gray-100">
				{`<GridList dragAndDropHooks={hooks}>
  {(item) => (
    <>
      <DropIndicator
        target={{
          type: "item",
          key: item.id,
          dropPosition: "before"
        }}
      />
      <GridList.Item>
        {item.name}
      </GridList.Item>
    </>
  )}
</GridList>`}
			</pre>
		</div>
	),
};

export const VisualRepresentation: Story = {
	render: () => (
		<div className="flex flex-col gap-4">
			<p className="text-sm text-gray-600">
				Visual representation of drop indicators in a list during drag operation:
			</p>
			<div className="w-64 rounded-lg border border-gray-200 bg-white">
				<div className="border-b border-gray-100 px-4 py-3 hover:bg-gray-50">
					<span className="text-gray-700">Document A</span>
				</div>
				<div className="relative">
					<div className="absolute inset-x-2 h-0.5 rounded bg-blue-500 shadow-sm shadow-blue-500/50" />
				</div>
				<div className="border-b border-gray-100 bg-blue-50 px-4 py-3 opacity-50">
					<span className="text-gray-700">Dragging: Document B</span>
				</div>
				<div className="border-b border-gray-100 px-4 py-3 hover:bg-gray-50">
					<span className="text-gray-700">Document C</span>
				</div>
				<div className="px-4 py-3 hover:bg-gray-50">
					<span className="text-gray-700">Document D</span>
				</div>
			</div>
		</div>
	),
};
