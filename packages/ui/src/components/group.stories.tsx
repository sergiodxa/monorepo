import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "./button";
import { Group } from "./group";
import { Input } from "./input";
import { Label } from "./label";
import { TextField } from "./text-field";

const meta: Meta<typeof Group> = {
	title: "Forms/Group",
	component: Group,
};

export default meta;
type Story = StoryObj<typeof Group>;

export const Default: Story = {
	render: (args) => (
		<Group {...args} className="flex gap-2">
			<Button>Button 1</Button>
			<Button>Button 2</Button>
			<Button>Button 3</Button>
		</Group>
	),
};

export const InputWithButton: Story = {
	render: () => (
		<TextField>
			<Label>Subscribe</Label>
			<Group className="flex">
				<Input placeholder="Enter your email" className="rounded-r-none" />
				<Button className="rounded-l-none">Subscribe</Button>
			</Group>
		</TextField>
	),
};

export const ButtonGroup: Story = {
	render: () => (
		<Group className="flex">
			<Button variant="outline" className="rounded-r-none">
				Left
			</Button>
			<Button variant="outline" className="rounded-none border-x-0">
				Center
			</Button>
			<Button variant="outline" className="rounded-l-none">
				Right
			</Button>
		</Group>
	),
};

export const Disabled: Story = {
	render: () => (
		<Group isDisabled className="flex gap-2">
			<Button>Disabled 1</Button>
			<Button>Disabled 2</Button>
			<Button>Disabled 3</Button>
		</Group>
	),
};

export const VerticalGroup: Story = {
	render: () => (
		<Group className="flex flex-col gap-2">
			<Button variant="outline" className="w-full">
				Option 1
			</Button>
			<Button variant="outline" className="w-full">
				Option 2
			</Button>
			<Button variant="outline" className="w-full">
				Option 3
			</Button>
		</Group>
	),
};

export const SearchInputGroup: Story = {
	render: () => (
		<TextField>
			<Label>Search</Label>
			<Group className="flex">
				<Input placeholder="Search..." className="rounded-r-none" />
				<Button color="primary" className="rounded-l-none">
					Search
				</Button>
			</Group>
		</TextField>
	),
};
