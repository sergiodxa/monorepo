import type { Meta, StoryObj } from "@storybook/react";

import { Input } from "./input";
import { Label } from "./label";
import { TextField } from "./text-field";

const meta: Meta<typeof Input> = {
	title: "Forms/Input",
	component: Input,
	argTypes: {
		disabled: { control: "boolean" },
	},
	args: {
		disabled: false,
	},
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
	render: (args) => (
		<TextField>
			<Label>Name</Label>
			<Input {...args} />
		</TextField>
	),
};

export const WithPlaceholder: Story = {
	render: () => (
		<TextField>
			<Label>Email</Label>
			<Input placeholder="you@example.com" />
		</TextField>
	),
};

export const WithDefaultValue: Story = {
	render: () => (
		<TextField>
			<Label>Name</Label>
			<Input defaultValue="John Doe" />
		</TextField>
	),
};

export const Disabled: Story = {
	render: () => (
		<TextField isDisabled>
			<Label>Name</Label>
			<Input defaultValue="Disabled value" />
		</TextField>
	),
};

export const ReadOnly: Story = {
	render: () => (
		<TextField isReadOnly>
			<Label>Account ID</Label>
			<Input defaultValue="ACC-12345-XYZ" />
		</TextField>
	),
};

export const Invalid: Story = {
	render: () => (
		<TextField isInvalid>
			<Label>Email</Label>
			<Input defaultValue="invalid-email" />
		</TextField>
	),
};

export const TypeEmail: Story = {
	render: () => (
		<TextField type="email">
			<Label>Email</Label>
			<Input placeholder="you@example.com" />
		</TextField>
	),
};

export const TypePassword: Story = {
	render: () => (
		<TextField type="password">
			<Label>Password</Label>
			<Input placeholder="Enter your password" />
		</TextField>
	),
};

export const TypeUrl: Story = {
	render: () => (
		<TextField type="url">
			<Label>Website</Label>
			<Input placeholder="https://example.com" />
		</TextField>
	),
};

export const TypeTel: Story = {
	render: () => (
		<TextField type="tel">
			<Label>Phone Number</Label>
			<Input placeholder="+1 (555) 123-4567" />
		</TextField>
	),
};
