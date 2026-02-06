import type { Meta, StoryObj } from "@storybook/react";

import { useState } from "react";

import { Label } from "./label";
import { TagGroup } from "./tag-group";

const meta: Meta<typeof TagGroup> = {
	title: "Collections/TagGroup",
	component: TagGroup,
};

export default meta;
type Story = StoryObj<typeof TagGroup>;

interface Skill {
	id: number;
	name: string;
}

const skills: Skill[] = [
	{ id: 1, name: "React" },
	{ id: 2, name: "TypeScript" },
	{ id: 3, name: "Node.js" },
	{ id: 4, name: "GraphQL" },
	{ id: 5, name: "PostgreSQL" },
];

export const Default: Story = {
	render: (args) => (
		<TagGroup {...args}>
			<Label>Skills</Label>
			<TagGroup.List>
				{skills.map((skill) => (
					<TagGroup.Tag key={skill.id} id={skill.id}>
						{skill.name}
					</TagGroup.Tag>
				))}
			</TagGroup.List>
		</TagGroup>
	),
};

export const SingleSelection: Story = {
	render: () => (
		<TagGroup selectionMode="single">
			<Label>Select a framework</Label>
			<TagGroup.List>
				<TagGroup.Tag id="react">React</TagGroup.Tag>
				<TagGroup.Tag id="vue">Vue</TagGroup.Tag>
				<TagGroup.Tag id="angular">Angular</TagGroup.Tag>
				<TagGroup.Tag id="svelte">Svelte</TagGroup.Tag>
			</TagGroup.List>
		</TagGroup>
	),
};

export const MultipleSelection: Story = {
	render: () => (
		<TagGroup selectionMode="multiple" defaultSelectedKeys={[1, 2]}>
			<Label>Select your skills</Label>
			<TagGroup.List>
				{skills.map((skill) => (
					<TagGroup.Tag key={skill.id} id={skill.id}>
						{skill.name}
					</TagGroup.Tag>
				))}
			</TagGroup.List>
		</TagGroup>
	),
};

export const Removable: Story = {
	render: function RemovableTags() {
		let [items, setItems] = useState(skills);

		return (
			<TagGroup
				onRemove={(keys) => {
					setItems((prev) => prev.filter((item) => !keys.has(item.id)));
				}}
			>
				<Label>Your skills (click X to remove)</Label>
				<TagGroup.List items={items}>
					{(item) => <TagGroup.Tag id={item.id}>{item.name}</TagGroup.Tag>}
				</TagGroup.List>
			</TagGroup>
		);
	},
};

export const StatusTags: Story = {
	render: () => (
		<TagGroup>
			<Label>Order status</Label>
			<TagGroup.List>
				<TagGroup.Tag id="pending" color="warning">
					Pending
				</TagGroup.Tag>
				<TagGroup.Tag id="processing" color="primary">
					Processing
				</TagGroup.Tag>
				<TagGroup.Tag id="shipped" color="success">
					Shipped
				</TagGroup.Tag>
				<TagGroup.Tag id="cancelled" color="danger">
					Cancelled
				</TagGroup.Tag>
			</TagGroup.List>
		</TagGroup>
	),
};

export const DisabledTags: Story = {
	render: () => (
		<TagGroup selectionMode="multiple" disabledKeys={["typescript", "graphql"]}>
			<Label>Skills (some disabled)</Label>
			<TagGroup.List>
				<TagGroup.Tag id="react">React</TagGroup.Tag>
				<TagGroup.Tag id="typescript">TypeScript</TagGroup.Tag>
				<TagGroup.Tag id="nodejs">Node.js</TagGroup.Tag>
				<TagGroup.Tag id="graphql">GraphQL</TagGroup.Tag>
			</TagGroup.List>
		</TagGroup>
	),
};

export const WithLinks: Story = {
	render: () => (
		<TagGroup>
			<Label>Categories</Label>
			<TagGroup.List>
				<TagGroup.Tag id="tech" href="/categories/tech">
					Technology
				</TagGroup.Tag>
				<TagGroup.Tag id="design" href="/categories/design">
					Design
				</TagGroup.Tag>
				<TagGroup.Tag id="business" href="/categories/business">
					Business
				</TagGroup.Tag>
			</TagGroup.List>
		</TagGroup>
	),
};

export const Empty: Story = {
	render: () => (
		<TagGroup>
			<Label>Tags</Label>
			<TagGroup.List renderEmptyState={() => <span>No tags added</span>}>{[]}</TagGroup.List>
		</TagGroup>
	),
};
