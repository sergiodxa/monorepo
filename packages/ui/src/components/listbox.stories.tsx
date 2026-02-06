import type { Meta, StoryObj } from "@storybook/react";

import { Header } from "./header";
import { ListBox } from "./listbox";
import { Text } from "./text";

const meta: Meta<typeof ListBox> = {
	title: "Selection/ListBox",
	component: ListBox,
	args: {
		selectionMode: "none",
	},
	argTypes: {
		selectionMode: { control: "select", options: ["none", "single", "multiple"] },
	},
};

export default meta;
type Story = StoryObj<typeof ListBox>;

export const Default: Story = {
	render: (args) => (
		<ListBox {...args} aria-label="Fruits" selectionMode="single">
			<ListBox.Item id="apple">Apple</ListBox.Item>
			<ListBox.Item id="banana">Banana</ListBox.Item>
			<ListBox.Item id="orange">Orange</ListBox.Item>
			<ListBox.Item id="grape">Grape</ListBox.Item>
		</ListBox>
	),
};

export const MultipleSelection: Story = {
	render: (args) => (
		<ListBox {...args} aria-label="Fruits" selectionMode="multiple">
			<ListBox.Item id="apple">Apple</ListBox.Item>
			<ListBox.Item id="banana">Banana</ListBox.Item>
			<ListBox.Item id="orange">Orange</ListBox.Item>
			<ListBox.Item id="grape">Grape</ListBox.Item>
		</ListBox>
	),
};

export const WithDefaultSelection: Story = {
	render: (args) => (
		<ListBox
			{...args}
			aria-label="Fruits"
			selectionMode="multiple"
			defaultSelectedKeys={["apple", "orange"]}
		>
			<ListBox.Item id="apple">Apple</ListBox.Item>
			<ListBox.Item id="banana">Banana</ListBox.Item>
			<ListBox.Item id="orange">Orange</ListBox.Item>
			<ListBox.Item id="grape">Grape</ListBox.Item>
		</ListBox>
	),
};

export const AllItemsDisabled: Story = {
	render: (args) => (
		<ListBox
			{...args}
			aria-label="Fruits"
			selectionMode="single"
			disabledKeys={["apple", "banana", "orange"]}
		>
			<ListBox.Item id="apple">Apple</ListBox.Item>
			<ListBox.Item id="banana">Banana</ListBox.Item>
			<ListBox.Item id="orange">Orange</ListBox.Item>
		</ListBox>
	),
};

export const WithDisabledItems: Story = {
	render: (args) => (
		<ListBox {...args} aria-label="Fruits" selectionMode="single" disabledKeys={["banana"]}>
			<ListBox.Item id="apple">Apple</ListBox.Item>
			<ListBox.Item id="banana">Banana (unavailable)</ListBox.Item>
			<ListBox.Item id="orange">Orange</ListBox.Item>
		</ListBox>
	),
};

export const WithSections: Story = {
	render: (args) => (
		<ListBox {...args} aria-label="Food" selectionMode="single">
			<ListBox.Section>
				<Header>Fruits</Header>
				<ListBox.Item id="apple">Apple</ListBox.Item>
				<ListBox.Item id="banana">Banana</ListBox.Item>
				<ListBox.Item id="orange">Orange</ListBox.Item>
			</ListBox.Section>
			<ListBox.Section>
				<Header>Vegetables</Header>
				<ListBox.Item id="carrot">Carrot</ListBox.Item>
				<ListBox.Item id="broccoli">Broccoli</ListBox.Item>
				<ListBox.Item id="spinach">Spinach</ListBox.Item>
			</ListBox.Section>
		</ListBox>
	),
};

export const WithItemDescriptions: Story = {
	render: (args) => (
		<ListBox {...args} aria-label="Plans" selectionMode="single">
			<ListBox.Item id="free" textValue="Free">
				<Text slot="label">Free</Text>
				<Text slot="description">Basic features, limited usage</Text>
			</ListBox.Item>
			<ListBox.Item id="pro" textValue="Pro">
				<Text slot="label">Pro</Text>
				<Text slot="description">All features, unlimited usage</Text>
			</ListBox.Item>
			<ListBox.Item id="enterprise" textValue="Enterprise">
				<Text slot="label">Enterprise</Text>
				<Text slot="description">Custom solutions, dedicated support</Text>
			</ListBox.Item>
		</ListBox>
	),
};

export const NoSelection: Story = {
	render: (args) => (
		<ListBox {...args} aria-label="Links" selectionMode="none">
			<ListBox.Item id="home">Home</ListBox.Item>
			<ListBox.Item id="about">About</ListBox.Item>
			<ListBox.Item id="contact">Contact</ListBox.Item>
		</ListBox>
	),
};
