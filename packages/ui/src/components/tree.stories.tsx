import type { Meta, StoryObj } from "@storybook/react";

import { Checkbox } from "./checkbox";
import { Tree } from "./tree";

const meta: Meta<typeof Tree> = {
	title: "Collections/Tree",
	component: Tree,
	args: {
		selectionMode: "none",
	},
	argTypes: {
		selectionMode: { control: "select", options: ["none", "single", "multiple"] },
	},
};

export default meta;
type Story = StoryObj<typeof Tree>;

interface FileNode {
	id: string;
	name: string;
	children?: FileNode[];
}

const fileTree: FileNode[] = [
	{
		id: "src",
		name: "src",
		children: [
			{
				id: "components",
				name: "components",
				children: [
					{ id: "button.tsx", name: "button.tsx" },
					{ id: "input.tsx", name: "input.tsx" },
					{ id: "modal.tsx", name: "modal.tsx" },
				],
			},
			{
				id: "hooks",
				name: "hooks",
				children: [
					{ id: "use-auth.ts", name: "use-auth.ts" },
					{ id: "use-form.ts", name: "use-form.ts" },
				],
			},
			{ id: "index.tsx", name: "index.tsx" },
			{ id: "app.tsx", name: "app.tsx" },
		],
	},
	{
		id: "public",
		name: "public",
		children: [
			{ id: "favicon.ico", name: "favicon.ico" },
			{ id: "index.html", name: "index.html" },
		],
	},
	{ id: "package.json", name: "package.json" },
	{ id: "tsconfig.json", name: "tsconfig.json" },
	{ id: "README.md", name: "README.md" },
];

function renderTreeItems(items: FileNode[]): React.ReactNode {
	return items.map((item) => (
		<Tree.Item key={item.id} textValue={item.name}>
			<Tree.ItemContent>
				{item.children && <Tree.ExpandButton />}
				<span>{item.name}</span>
			</Tree.ItemContent>
			{item.children && renderTreeItems(item.children)}
		</Tree.Item>
	));
}

export const Default: Story = {
	render: (args) => (
		<Tree aria-label="File tree" {...args}>
			{renderTreeItems(fileTree)}
		</Tree>
	),
};

export const SingleSelection: Story = {
	render: () => (
		<Tree aria-label="File tree" selectionMode="single">
			{renderTreeItems(fileTree)}
		</Tree>
	),
};

export const MultipleSelection: Story = {
	render: () => {
		function renderWithCheckbox(items: FileNode[]): React.ReactNode {
			return items.map((item) => (
				<Tree.Item key={item.id} textValue={item.name}>
					<Tree.ItemContent>
						{item.children && <Tree.ExpandButton />}
						<Checkbox slot="selection" />
						<span>{item.name}</span>
					</Tree.ItemContent>
					{item.children && renderWithCheckbox(item.children)}
				</Tree.Item>
			));
		}

		return (
			<Tree aria-label="File tree" selectionMode="multiple">
				{renderWithCheckbox(fileTree)}
			</Tree>
		);
	},
};

export const ExpandedByDefault: Story = {
	render: () => (
		<Tree aria-label="File tree" defaultExpandedKeys={["src", "components"]}>
			{renderTreeItems(fileTree)}
		</Tree>
	),
};

export const DisabledItems: Story = {
	render: () => (
		<Tree
			aria-label="File tree"
			selectionMode="multiple"
			disabledKeys={["package.json", "tsconfig.json"]}
		>
			{renderTreeItems(fileTree)}
		</Tree>
	),
};

interface DepartmentNode {
	id: string;
	name: string;
	role?: string;
	children?: DepartmentNode[];
}

const orgTree: DepartmentNode[] = [
	{
		id: "engineering",
		name: "Engineering",
		children: [
			{
				id: "frontend",
				name: "Frontend Team",
				children: [
					{ id: "alice", name: "Alice Johnson", role: "Lead" },
					{ id: "bob", name: "Bob Smith", role: "Senior" },
					{ id: "carol", name: "Carol White", role: "Developer" },
				],
			},
			{
				id: "backend",
				name: "Backend Team",
				children: [
					{ id: "david", name: "David Brown", role: "Lead" },
					{ id: "eve", name: "Eve Davis", role: "Senior" },
				],
			},
		],
	},
	{
		id: "design",
		name: "Design",
		children: [
			{ id: "frank", name: "Frank Miller", role: "Lead" },
			{ id: "grace", name: "Grace Lee", role: "Designer" },
		],
	},
	{
		id: "product",
		name: "Product",
		children: [{ id: "henry", name: "Henry Wilson", role: "PM" }],
	},
];

export const OrganizationTree: Story = {
	render: () => {
		function renderOrgTree(items: DepartmentNode[]): React.ReactNode {
			return items.map((item) => (
				<Tree.Item key={item.id} textValue={item.name}>
					<Tree.ItemContent>
						{item.children && <Tree.ExpandButton />}
						<span>{item.name}</span>
						{item.role && <span className="text-neutral-500 text-sm ml-2">({item.role})</span>}
					</Tree.ItemContent>
					{item.children && renderOrgTree(item.children)}
				</Tree.Item>
			));
		}

		return (
			<Tree aria-label="Organization" defaultExpandedKeys={["engineering", "frontend"]}>
				{renderOrgTree(orgTree)}
			</Tree>
		);
	},
};

export const Empty: Story = {
	render: () => (
		<Tree aria-label="Empty tree" renderEmptyState={() => <span>No items</span>}>
			{[]}
		</Tree>
	),
};
