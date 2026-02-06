import type { Meta, StoryObj } from "@storybook/react";

import { Checkbox } from "./checkbox";
import { CheckboxGroup } from "./checkbox-group";
import { Label } from "./label";
import { Text } from "./text";

const meta: Meta<typeof CheckboxGroup> = {
	title: "Selection/CheckboxGroup",
	component: CheckboxGroup,
	argTypes: {
		isDisabled: { control: "boolean" },
		isInvalid: { control: "boolean" },
	},
	args: {
		isDisabled: false,
		isInvalid: false,
	},
};

export default meta;
type Story = StoryObj<typeof CheckboxGroup>;

export const Default: Story = {
	render: (args) => (
		<CheckboxGroup {...args}>
			<Label>Favorite fruits</Label>
			<Checkbox value="apple">Apple</Checkbox>
			<Checkbox value="banana">Banana</Checkbox>
			<Checkbox value="orange">Orange</Checkbox>
		</CheckboxGroup>
	),
};

export const WithDefaultValue: Story = {
	render: (args) => (
		<CheckboxGroup {...args} defaultValue={["apple", "orange"]}>
			<Label>Favorite fruits</Label>
			<Checkbox value="apple">Apple</Checkbox>
			<Checkbox value="banana">Banana</Checkbox>
			<Checkbox value="orange">Orange</Checkbox>
		</CheckboxGroup>
	),
};

export const Disabled: Story = {
	render: (args) => (
		<CheckboxGroup {...args} isDisabled>
			<Label>Favorite fruits</Label>
			<Checkbox value="apple">Apple</Checkbox>
			<Checkbox value="banana">Banana</Checkbox>
			<Checkbox value="orange">Orange</Checkbox>
		</CheckboxGroup>
	),
};

export const Invalid: Story = {
	render: (args) => (
		<CheckboxGroup {...args} isInvalid>
			<Label>Favorite fruits</Label>
			<Checkbox value="apple">Apple</Checkbox>
			<Checkbox value="banana">Banana</Checkbox>
			<Checkbox value="orange">Orange</Checkbox>
			<Text slot="errorMessage">Please select at least one fruit</Text>
		</CheckboxGroup>
	),
};

export const WithDescription: Story = {
	render: (args) => (
		<CheckboxGroup {...args}>
			<Label>Notifications</Label>
			<Text slot="description">Choose which notifications you would like to receive</Text>
			<Checkbox value="email">Email notifications</Checkbox>
			<Checkbox value="sms">SMS notifications</Checkbox>
			<Checkbox value="push">Push notifications</Checkbox>
		</CheckboxGroup>
	),
};

export const Horizontal: Story = {
	render: (args) => (
		<CheckboxGroup {...args}>
			<Label>Favorite fruits</Label>
			<div className="flex gap-4">
				<Checkbox value="apple">Apple</Checkbox>
				<Checkbox value="banana">Banana</Checkbox>
				<Checkbox value="orange">Orange</Checkbox>
			</div>
		</CheckboxGroup>
	),
};
