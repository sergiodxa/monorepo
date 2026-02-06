import type { Meta, StoryObj } from "@storybook/react";

import { useState } from "react";
import { isTextDropItem } from "react-aria-components";

import { Button } from "./button";
import { DropZone } from "./drop-zone";
import { FileTrigger } from "./file-trigger";

const meta: Meta<typeof DropZone> = {
	title: "File/DropZone",
	component: DropZone,
};

export default meta;
type Story = StoryObj<typeof DropZone>;

export const Default: Story = {
	render: (args) => (
		<DropZone
			{...args}
			className="flex h-32 w-64 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-4 data-[drop-target]:border-blue-500 data-[drop-target]:bg-blue-50"
		>
			<p className="text-center text-gray-500">Drop files here</p>
		</DropZone>
	),
};

export const WithFileTrigger: Story = {
	render: () => (
		<DropZone className="flex h-40 w-80 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 p-4 data-[drop-target]:border-blue-500 data-[drop-target]:bg-blue-50">
			<p className="text-center text-gray-500">Drop files here or</p>
			<FileTrigger allowsMultiple>
				<Button variant="outline" size="sm">
					Browse Files
				</Button>
			</FileTrigger>
		</DropZone>
	),
};

export const WithFileList: Story = {
	render: function Render() {
		let [files, setFiles] = useState<string[]>([]);

		return (
			<div className="flex flex-col gap-4">
				<DropZone
					className="flex h-40 w-80 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 p-4 data-[drop-target]:border-blue-500 data-[drop-target]:bg-blue-50"
					onDrop={async (e) => {
						let fileItems = e.items.filter((item) => item.kind === "file");
						let names = await Promise.all(
							fileItems.map(async (item) => {
								if (item.kind === "file") {
									let file = await item.getFile();
									return file.name;
								}
								return "";
							}),
						);
						setFiles(names.filter(Boolean));
					}}
				>
					<p className="text-center text-gray-500">Drop files here</p>
				</DropZone>
				{files.length > 0 && (
					<div>
						<p className="font-medium">Dropped files:</p>
						<ul className="list-inside list-disc">
							{files.map((name) => (
								<li key={name}>{name}</li>
							))}
						</ul>
					</div>
				)}
			</div>
		);
	},
};

export const TextDrop: Story = {
	render: function Render() {
		let [text, setText] = useState<string>("");

		return (
			<div className="flex flex-col gap-4">
				<p className="text-sm text-gray-600">Select and drag some text into the drop zone:</p>
				<DropZone
					className="flex h-32 w-80 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-4 data-[drop-target]:border-blue-500 data-[drop-target]:bg-blue-50"
					onDrop={async (e) => {
						let textItem = e.items.find(isTextDropItem);
						if (textItem) {
							let droppedText = await textItem.getText("text/plain");
							setText(droppedText);
						}
					}}
				>
					<p className="text-center text-gray-500">Drop text here</p>
				</DropZone>
				{text && (
					<div className="rounded bg-gray-100 p-2">
						<p className="font-medium">Dropped text:</p>
						<p>{text}</p>
					</div>
				)}
			</div>
		);
	},
};

export const VisualFeedback: Story = {
	render: () => (
		<DropZone className="flex h-40 w-80 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-4 transition-colors data-[drop-target]:border-green-500 data-[drop-target]:bg-green-50 data-[focus-visible]:outline data-[focus-visible]:outline-2 data-[focus-visible]:outline-blue-500">
			<svg
				className="h-10 w-10 text-gray-400"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={2}
					d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
				/>
			</svg>
			<p className="text-center text-gray-500">Drag and drop files here</p>
			<p className="text-center text-sm text-gray-400">or click to browse</p>
		</DropZone>
	),
};
