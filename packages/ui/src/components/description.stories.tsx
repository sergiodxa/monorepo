import type { Meta, StoryObj } from "@storybook/react";

import { Description } from "./description";
import { Input } from "./input";
import { Label } from "./label";
import { TextField } from "./text-field";

const meta: Meta<typeof Description> = {
	title: "Forms/Description",
	component: Description,
	args: {
		children: "This is a description text that provides additional context.",
	},
};

export default meta;
type Story = StoryObj<typeof Description>;

export const Default: Story = {
	render: (args) => <Description {...args} />,
};

export const WithTextField: Story = {
	render: () => (
		<TextField>
			<Label>Email</Label>
			<Input type="email" />
			<Description>We'll never share your email with anyone else.</Description>
		</TextField>
	),
};

export const WithInstructions: Story = {
	render: () => (
		<TextField>
			<Label>Password</Label>
			<Input type="password" />
			<Description>
				Must be at least 8 characters and include a number and special character.
			</Description>
		</TextField>
	),
};

export const WithConstraints: Story = {
	render: () => (
		<TextField>
			<Label>Username</Label>
			<Input />
			<Description>3-20 characters, letters and numbers only.</Description>
		</TextField>
	),
};

export const WithCustomStyling: Story = {
	render: () => (
		<TextField>
			<Label>API Key</Label>
			<Input />
			<Description className="text-warning-600">
				Keep this key secret. Do not share it publicly.
			</Description>
		</TextField>
	),
};
