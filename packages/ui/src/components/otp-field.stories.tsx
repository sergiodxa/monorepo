import type { Meta, StoryObj } from "@storybook/react";

import { Description } from "./description";
import { FieldError } from "./field-error";
import { Label } from "./label";
import { OtpField } from "./otp-field";

const meta: Meta<typeof OtpField> = {
	title: "Forms/OtpField",
	component: OtpField,
	argTypes: {
		length: { control: { type: "number", min: 4, max: 8, step: 1 } },
		isDisabled: { control: "boolean" },
		isReadOnly: { control: "boolean" },
		isRequired: { control: "boolean" },
		isInvalid: { control: "boolean" },
	},
	args: {
		length: 6,
		isDisabled: false,
		isReadOnly: false,
		isRequired: false,
		isInvalid: false,
		"aria-label": "Verification code",
	},
};

export default meta;
type Story = StoryObj<typeof OtpField>;

export const Default: Story = {
	render: (args) => (
		<OtpField {...args} name="otp">
			<Label>Verification code</Label>
			<OtpField.Slots />
			<Description>Enter the 6-digit code from your email.</Description>
			<FieldError>Code must be 6 digits.</FieldError>
		</OtpField>
	),
};

export const WithSeparator: Story = {
	render: () => (
		<OtpField length={6} aria-label="Security code">
			<Label>Security code</Label>
			<OtpField.Slots separator={<OtpField.Separator>-</OtpField.Separator>} />
		</OtpField>
	),
};
