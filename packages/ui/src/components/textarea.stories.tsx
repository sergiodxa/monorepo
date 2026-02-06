import type { Meta, StoryObj } from "@storybook/react";

import { Description } from "./description";
import { FieldError } from "./field-error";
import { Label } from "./label";
import { TextField } from "./text-field";
import { TextArea } from "./textarea";

const meta: Meta<typeof TextArea> = {
	title: "Forms/TextArea",
	component: TextArea,
	argTypes: {
		disabled: { control: "boolean" },
	},
	args: {
		disabled: false,
	},
};

export default meta;
type Story = StoryObj<typeof TextArea>;

export const Default: Story = {
	render: (args) => (
		<TextField>
			<Label>Message</Label>
			<TextArea {...args} />
		</TextField>
	),
};

export const WithPlaceholder: Story = {
	render: () => (
		<TextField>
			<Label>Bio</Label>
			<TextArea placeholder="Tell us about yourself..." />
		</TextField>
	),
};

export const WithDescription: Story = {
	render: () => (
		<TextField>
			<Label>Description</Label>
			<TextArea placeholder="Enter a description..." />
			<Description>Maximum 500 characters</Description>
		</TextField>
	),
};

export const WithDefaultValue: Story = {
	render: () => (
		<TextField>
			<Label>Notes</Label>
			<TextArea defaultValue="These are some pre-filled notes that can be edited by the user." />
		</TextField>
	),
};

export const Disabled: Story = {
	render: () => (
		<TextField isDisabled>
			<Label>Notes</Label>
			<TextArea defaultValue="This textarea is disabled and cannot be edited." />
		</TextField>
	),
};

export const ReadOnly: Story = {
	render: () => (
		<TextField isReadOnly>
			<Label>Terms of Service</Label>
			<TextArea defaultValue="These are the terms of service. They cannot be modified." />
		</TextField>
	),
};

export const Invalid: Story = {
	render: () => (
		<TextField isInvalid>
			<Label>Comment</Label>
			<TextArea defaultValue="Too short" />
			<FieldError>Comment must be at least 50 characters</FieldError>
		</TextField>
	),
};

export const Required: Story = {
	render: () => (
		<TextField isRequired>
			<Label>Feedback</Label>
			<TextArea placeholder="Please provide your feedback..." />
			<Description>Your feedback helps us improve</Description>
		</TextField>
	),
};

export const WithRows: Story = {
	render: () => (
		<TextField>
			<Label>Long Form Content</Label>
			<TextArea rows={10} placeholder="Write your article here..." />
			<Description>Use this area for longer content</Description>
		</TextField>
	),
};

export const WithAllSubComponents: Story = {
	render: () => (
		<TextField isInvalid>
			<Label>Review</Label>
			<TextArea defaultValue="Bad" rows={4} />
			<Description>Share your experience with the product</Description>
			<FieldError>Review must be at least 20 characters</FieldError>
		</TextField>
	),
};
