import type { Meta, StoryObj } from "@storybook/react";

import { Description } from "./description";
import { FieldError } from "./field-error";
import { Input } from "./input";
import { Label } from "./label";
import { TextField } from "./text-field";

const meta: Meta<typeof TextField> = {
	title: "Forms/TextField",
	component: TextField,
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
type Story = StoryObj<typeof TextField>;

export const Default: Story = {
	render: (args) => (
		<TextField {...args}>
			<Label>Name</Label>
			<Input />
		</TextField>
	),
};

export const WithDescription: Story = {
	render: () => (
		<TextField>
			<Label>Email</Label>
			<Input type="email" />
			<Description>We'll use this for account notifications</Description>
		</TextField>
	),
};

export const WithFieldError: Story = {
	render: () => (
		<TextField isInvalid>
			<Label>Email</Label>
			<Input type="email" defaultValue="invalid" />
			<FieldError>Please enter a valid email address</FieldError>
		</TextField>
	),
};

export const WithAllSubComponents: Story = {
	render: () => (
		<TextField isInvalid>
			<Label>Username</Label>
			<Input defaultValue="ab" />
			<Description>Choose a unique username (3-20 characters)</Description>
			<FieldError>Username must be at least 3 characters</FieldError>
		</TextField>
	),
};

export const Disabled: Story = {
	render: () => (
		<TextField isDisabled>
			<Label>Name</Label>
			<Input defaultValue="John Doe" />
		</TextField>
	),
};

export const ReadOnly: Story = {
	render: () => (
		<TextField isReadOnly>
			<Label>Account ID</Label>
			<Input defaultValue="ACC-12345" />
			<Description>This value cannot be changed</Description>
		</TextField>
	),
};

export const Required: Story = {
	render: () => (
		<TextField isRequired>
			<Label>Email</Label>
			<Input type="email" />
			<Description>Required field</Description>
		</TextField>
	),
};

export const EmailType: Story = {
	render: () => (
		<TextField type="email">
			<Label>Email Address</Label>
			<Input />
		</TextField>
	),
};

export const PasswordType: Story = {
	render: () => (
		<TextField type="password">
			<Label>Password</Label>
			<Input />
			<Description>Must be at least 8 characters</Description>
		</TextField>
	),
};

export const WithPlaceholder: Story = {
	render: () => (
		<TextField>
			<Label>Search</Label>
			<Input placeholder="Type to search..." />
		</TextField>
	),
};
