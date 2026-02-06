import type { Meta, StoryObj } from "@storybook/react";

import { Description } from "./description";
import { FieldError } from "./field-error";
import { Input } from "./input";
import { Label } from "./label";
import { TextField } from "./text-field";

const meta: Meta<typeof FieldError> = {
	title: "Forms/FieldError",
	component: FieldError,
	args: {
		children: "This field has an error.",
	},
};

export default meta;
type Story = StoryObj<typeof FieldError>;

export const Default: Story = {
	render: (args) => (
		<TextField isInvalid>
			<Label>Email</Label>
			<Input type="email" defaultValue="invalid-email" />
			<FieldError {...args} />
		</TextField>
	),
};

export const WithTextField: Story = {
	render: () => (
		<TextField isInvalid>
			<Label>Email</Label>
			<Input type="email" defaultValue="invalid-email" />
			<FieldError>Please enter a valid email address.</FieldError>
		</TextField>
	),
};

export const RequiredFieldError: Story = {
	render: () => (
		<TextField isInvalid>
			<Label>Name</Label>
			<Input />
			<FieldError>This field is required.</FieldError>
		</TextField>
	),
};

export const LengthValidationError: Story = {
	render: () => (
		<TextField isInvalid>
			<Label>Username</Label>
			<Input defaultValue="ab" />
			<Description>3-20 characters required</Description>
			<FieldError>Username must be at least 3 characters long.</FieldError>
		</TextField>
	),
};

export const FormatValidationError: Story = {
	render: () => (
		<TextField isInvalid>
			<Label>Phone Number</Label>
			<Input type="tel" defaultValue="abc123" />
			<FieldError>Please enter a valid phone number (e.g., +1-555-123-4567).</FieldError>
		</TextField>
	),
};

export const WithCustomStyling: Story = {
	render: () => (
		<TextField isInvalid>
			<Label>Credit Card</Label>
			<Input defaultValue="1234" />
			<FieldError className="font-bold">
				Invalid card number. Please check and try again.
			</FieldError>
		</TextField>
	),
};

export const MultipleErrors: Story = {
	render: () => (
		<div className="flex flex-col gap-4">
			<TextField isInvalid>
				<Label>Email</Label>
				<Input type="email" defaultValue="bad" />
				<FieldError>Invalid email format.</FieldError>
			</TextField>
			<TextField isInvalid>
				<Label>Password</Label>
				<Input type="password" defaultValue="123" />
				<FieldError>Password must be at least 8 characters.</FieldError>
			</TextField>
		</div>
	),
};
