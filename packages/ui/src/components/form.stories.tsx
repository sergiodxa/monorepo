import type { Meta, StoryObj } from "@storybook/react";

import { Description } from "./description";
import { FieldError } from "./field-error";
import { Form, type ValidationIssue } from "./form";
import { Input } from "./input";
import { Label } from "./label";
import { TextField } from "./text-field";

const meta: Meta<typeof Form> = {
	title: "Forms/Form",
	component: Form,
};

export default meta;
type Story = StoryObj<typeof Form>;

export const Default: Story = {
	render: (args) => (
		<Form {...args}>
			<TextField name="email">
				<Label>Email</Label>
				<Input type="email" />
			</TextField>
		</Form>
	),
};

export const WithMultipleFields: Story = {
	render: () => (
		<Form className="flex flex-col gap-4">
			<TextField name="name">
				<Label>Name</Label>
				<Input />
				<Description>Your full name</Description>
			</TextField>
			<TextField name="email">
				<Label>Email</Label>
				<Input type="email" />
				<Description>We'll never share your email</Description>
			</TextField>
		</Form>
	),
};

export const WithValidationErrors: Story = {
	render: () => {
		let issues: ValidationIssue[] = [
			{ path: ["email"], message: "Invalid email address" },
			{ path: ["password"], message: "Password must be at least 8 characters" },
		];

		return (
			<Form issues={issues} className="flex flex-col gap-4">
				<TextField name="email">
					<Label>Email</Label>
					<Input type="email" defaultValue="invalid-email" />
					<FieldError />
				</TextField>
				<TextField name="password">
					<Label>Password</Label>
					<Input type="password" defaultValue="short" />
					<FieldError />
				</TextField>
			</Form>
		);
	},
};

export const WithNestedPathErrors: Story = {
	render: () => {
		let issues: ValidationIssue[] = [
			{ path: ["user", "email"], message: "Email is required" },
			{ path: ["user", "profile", "bio"], message: "Bio is too long" },
		];

		return (
			<Form issues={issues} className="flex flex-col gap-4">
				<TextField name="user.email">
					<Label>Email</Label>
					<Input type="email" />
					<FieldError />
				</TextField>
				<TextField name="user.profile.bio">
					<Label>Bio</Label>
					<Input />
					<FieldError />
				</TextField>
			</Form>
		);
	},
};
