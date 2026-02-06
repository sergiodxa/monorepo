import type { Meta, StoryObj } from "@storybook/react";

import { useState } from "react";

import { Button } from "./button";
import { FileTrigger } from "./file-trigger";

const meta: Meta<typeof FileTrigger> = {
	title: "File/FileTrigger",
	component: FileTrigger,
};

export default meta;
type Story = StoryObj<typeof FileTrigger>;

export const Default: Story = {
	render: (args) => (
		<FileTrigger {...args}>
			<Button>Select File</Button>
		</FileTrigger>
	),
};

export const WithAcceptedFileTypes: Story = {
	render: () => (
		<div className="flex flex-col gap-4">
			<FileTrigger acceptedFileTypes={["image/*"]}>
				<Button>Select Image</Button>
			</FileTrigger>
			<FileTrigger acceptedFileTypes={[".pdf"]}>
				<Button>Select PDF</Button>
			</FileTrigger>
			<FileTrigger acceptedFileTypes={[".csv", ".xlsx"]}>
				<Button>Select Spreadsheet</Button>
			</FileTrigger>
		</div>
	),
};

export const AllowsMultiple: Story = {
	render: (args) => (
		<FileTrigger {...args} allowsMultiple>
			<Button>Select Multiple Files</Button>
		</FileTrigger>
	),
};

export const WithFileList: Story = {
	render: function Render() {
		let [files, setFiles] = useState<string[]>([]);

		return (
			<div className="flex flex-col gap-4">
				<FileTrigger
					allowsMultiple
					onSelect={(fileList) => {
						if (fileList) {
							setFiles(Array.from(fileList).map((file) => file.name));
						}
					}}
				>
					<Button>Select Files</Button>
				</FileTrigger>
				{files.length > 0 && (
					<ul className="list-inside list-disc">
						{files.map((name) => (
							<li key={name}>{name}</li>
						))}
					</ul>
				)}
			</div>
		);
	},
};

export const DirectorySelection: Story = {
	render: (args) => (
		<FileTrigger {...args} acceptDirectory>
			<Button>Select Folder</Button>
		</FileTrigger>
	),
};
