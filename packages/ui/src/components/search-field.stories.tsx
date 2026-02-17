import type { Meta, StoryObj } from "@storybook/react";

import { Description } from "./description";
import { Label } from "./label";
import { SearchField } from "./search-field";

const meta: Meta<typeof SearchField> = {
	title: "Forms/SearchField",
	component: SearchField,
	argTypes: {
		isDisabled: { control: "boolean" },
		isReadOnly: { control: "boolean" },
		isRequired: { control: "boolean" },
		isInvalid: { control: "boolean" },
	},
	args: {
		isDisabled: false,
		isReadOnly: false,
		isRequired: false,
		isInvalid: false,
	},
};

export default meta;
type Story = StoryObj<typeof SearchField>;

export const Default: Story = {
	render: (args) => (
		<SearchField {...args}>
			<Label>Search</Label>
			<SearchField.Input placeholder="Search..." />
		</SearchField>
	),
};

export const WithDefaultValue: Story = {
	render: () => (
		<SearchField defaultValue="React">
			<Label>Search</Label>
			<SearchField.Input />
		</SearchField>
	),
};

export const WithDescription: Story = {
	render: () => (
		<SearchField>
			<Label>Search Products</Label>
			<SearchField.Input placeholder="Enter product name..." />
			<Description>Search by name, SKU, or description</Description>
		</SearchField>
	),
};

export const Disabled: Story = {
	render: () => (
		<SearchField isDisabled>
			<Label>Search</Label>
			<SearchField.Input placeholder="Search..." />
		</SearchField>
	),
};

export const ReadOnly: Story = {
	render: () => (
		<SearchField isReadOnly defaultValue="Locked search term">
			<Label>Search</Label>
			<SearchField.Input />
		</SearchField>
	),
};

export const WithoutLabel: Story = {
	render: () => (
		<SearchField aria-label="Search">
			<SearchField.Input placeholder="Search..." />
		</SearchField>
	),
};
