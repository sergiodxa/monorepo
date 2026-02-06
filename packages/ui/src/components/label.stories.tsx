import type { Meta, StoryObj } from "@storybook/react";

import { Input } from "./input";
import { Label } from "./label";
import { TextField } from "./text-field";

const meta: Meta<typeof Label> = {
	title: "Forms/Label",
	component: Label,
	args: {
		children: "Label Text",
	},
};

export default meta;
type Story = StoryObj<typeof Label>;

export const Default: Story = {
	render: (args) => <Label {...args} />,
};

export const WithTextField: Story = {
	render: () => (
		<TextField>
			<Label>Email Address</Label>
			<Input type="email" />
		</TextField>
	),
};

export const RequiredField: Story = {
	render: () => (
		<TextField isRequired>
			<Label>
				Username <span className="text-danger-500">*</span>
			</Label>
			<Input />
		</TextField>
	),
};

export const WithCustomStyling: Story = {
	render: () => (
		<TextField>
			<Label className="font-bold text-primary-600">Custom Styled Label</Label>
			<Input />
		</TextField>
	),
};
