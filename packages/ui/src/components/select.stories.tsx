import type { Meta, StoryObj } from "@storybook/react";

import { Header } from "./header";
import { Label } from "./label";
import { ListBox } from "./listbox";
import { Popover } from "./popover";
import { Select } from "./select";
import { Text } from "./text";

const meta: Meta<typeof Select> = {
	title: "Selection/Select",
	component: Select,
	args: {
		isDisabled: false,
		isInvalid: false,
	},
	argTypes: {
		isDisabled: { control: "boolean" },
		isInvalid: { control: "boolean" },
	},
};

export default meta;
type Story = StoryObj<typeof Select>;

export const Default: Story = {
	render: (args) => (
		<Select {...args} placeholder="Select a fruit">
			<Label>Favorite fruit</Label>
			<Select.Trigger />
			<Popover>
				<ListBox>
					<Select.Item id="apple">Apple</Select.Item>
					<Select.Item id="banana">Banana</Select.Item>
					<Select.Item id="orange">Orange</Select.Item>
					<Select.Item id="grape">Grape</Select.Item>
				</ListBox>
			</Popover>
		</Select>
	),
};

export const WithDefaultValue: Story = {
	render: (args) => (
		<Select {...args} defaultSelectedKey="banana">
			<Label>Favorite fruit</Label>
			<Select.Trigger />
			<Popover>
				<ListBox>
					<Select.Item id="apple">Apple</Select.Item>
					<Select.Item id="banana">Banana</Select.Item>
					<Select.Item id="orange">Orange</Select.Item>
					<Select.Item id="grape">Grape</Select.Item>
				</ListBox>
			</Popover>
		</Select>
	),
};

export const Disabled: Story = {
	render: (args) => (
		<Select {...args} isDisabled placeholder="Select a fruit">
			<Label>Favorite fruit</Label>
			<Select.Trigger />
			<Popover>
				<ListBox>
					<Select.Item id="apple">Apple</Select.Item>
					<Select.Item id="banana">Banana</Select.Item>
					<Select.Item id="orange">Orange</Select.Item>
				</ListBox>
			</Popover>
		</Select>
	),
};

export const Invalid: Story = {
	render: (args) => (
		<Select {...args} isInvalid placeholder="Select a fruit">
			<Label>Favorite fruit</Label>
			<Select.Trigger />
			<Text slot="errorMessage">Please select a fruit</Text>
			<Popover>
				<ListBox>
					<Select.Item id="apple">Apple</Select.Item>
					<Select.Item id="banana">Banana</Select.Item>
					<Select.Item id="orange">Orange</Select.Item>
				</ListBox>
			</Popover>
		</Select>
	),
};

export const WithDescription: Story = {
	render: (args) => (
		<Select {...args} placeholder="Select a country">
			<Label>Country</Label>
			<Text slot="description">Choose your country of residence</Text>
			<Select.Trigger />
			<Popover>
				<ListBox>
					<Select.Item id="us">United States</Select.Item>
					<Select.Item id="uk">United Kingdom</Select.Item>
					<Select.Item id="ca">Canada</Select.Item>
					<Select.Item id="au">Australia</Select.Item>
				</ListBox>
			</Popover>
		</Select>
	),
};

export const WithSections: Story = {
	render: (args) => (
		<Select {...args} placeholder="Select a food">
			<Label>Food</Label>
			<Select.Trigger />
			<Popover>
				<ListBox>
					<Select.Section>
						<Header>Fruits</Header>
						<Select.Item id="apple">Apple</Select.Item>
						<Select.Item id="banana">Banana</Select.Item>
						<Select.Item id="orange">Orange</Select.Item>
					</Select.Section>
					<Select.Section>
						<Header>Vegetables</Header>
						<Select.Item id="carrot">Carrot</Select.Item>
						<Select.Item id="broccoli">Broccoli</Select.Item>
						<Select.Item id="spinach">Spinach</Select.Item>
					</Select.Section>
				</ListBox>
			</Popover>
		</Select>
	),
};

export const WithItemDescriptions: Story = {
	render: (args) => (
		<Select {...args} placeholder="Select a plan">
			<Label>Subscription plan</Label>
			<Select.Trigger />
			<Popover>
				<ListBox>
					<Select.Item id="free" textValue="Free">
						<Text slot="label">Free</Text>
						<Text slot="description">Basic features, limited usage</Text>
					</Select.Item>
					<Select.Item id="pro" textValue="Pro">
						<Text slot="label">Pro</Text>
						<Text slot="description">All features, unlimited usage</Text>
					</Select.Item>
					<Select.Item id="enterprise" textValue="Enterprise">
						<Text slot="label">Enterprise</Text>
						<Text slot="description">Custom solutions, dedicated support</Text>
					</Select.Item>
				</ListBox>
			</Popover>
		</Select>
	),
};

export const WithDisabledItems: Story = {
	render: (args) => (
		<Select {...args} placeholder="Select an option">
			<Label>Options</Label>
			<Select.Trigger />
			<Popover>
				<ListBox disabledKeys={["option2"]}>
					<Select.Item id="option1">Option 1</Select.Item>
					<Select.Item id="option2">Option 2 (unavailable)</Select.Item>
					<Select.Item id="option3">Option 3</Select.Item>
				</ListBox>
			</Popover>
		</Select>
	),
};
