import type { Meta, StoryObj } from "@storybook/react";

import { Label } from "./label";
import { Radio, RadioGroup } from "./radio-group";
import { Text } from "./text";

const meta: Meta<typeof RadioGroup> = {
	title: "Selection/RadioGroup",
	component: RadioGroup,
	args: {
		isDisabled: false,
		isInvalid: false,
		orientation: "vertical",
	},
	argTypes: {
		isDisabled: { control: "boolean" },
		isInvalid: { control: "boolean" },
		orientation: { control: "select", options: ["vertical", "horizontal"] },
	},
};

export default meta;
type Story = StoryObj<typeof RadioGroup>;

export const Default: Story = {
	render: (args) => (
		<RadioGroup {...args}>
			<Label>Favorite pet</Label>
			<Radio value="dog">Dog</Radio>
			<Radio value="cat">Cat</Radio>
			<Radio value="hamster">Hamster</Radio>
		</RadioGroup>
	),
};

export const WithDefaultValue: Story = {
	render: (args) => (
		<RadioGroup {...args} defaultValue="cat">
			<Label>Favorite pet</Label>
			<Radio value="dog">Dog</Radio>
			<Radio value="cat">Cat</Radio>
			<Radio value="hamster">Hamster</Radio>
		</RadioGroup>
	),
};

export const Disabled: Story = {
	render: (args) => (
		<RadioGroup {...args} isDisabled>
			<Label>Favorite pet</Label>
			<Radio value="dog">Dog</Radio>
			<Radio value="cat">Cat</Radio>
			<Radio value="hamster">Hamster</Radio>
		</RadioGroup>
	),
};

export const Invalid: Story = {
	render: (args) => (
		<RadioGroup {...args} isInvalid>
			<Label>Favorite pet</Label>
			<Radio value="dog">Dog</Radio>
			<Radio value="cat">Cat</Radio>
			<Radio value="hamster">Hamster</Radio>
			<Text slot="errorMessage">Please select an option</Text>
		</RadioGroup>
	),
};

export const WithDescription: Story = {
	render: (args) => (
		<RadioGroup {...args}>
			<Label>Shipping method</Label>
			<Text slot="description">Choose how you want your order delivered</Text>
			<Radio value="standard">Standard (5-7 days)</Radio>
			<Radio value="express">Express (2-3 days)</Radio>
			<Radio value="overnight">Overnight</Radio>
		</RadioGroup>
	),
};

export const Horizontal: Story = {
	render: (args) => (
		<RadioGroup {...args} orientation="horizontal">
			<Label>Size</Label>
			<div className="flex gap-4">
				<Radio value="sm">Small</Radio>
				<Radio value="md">Medium</Radio>
				<Radio value="lg">Large</Radio>
			</div>
		</RadioGroup>
	),
};
