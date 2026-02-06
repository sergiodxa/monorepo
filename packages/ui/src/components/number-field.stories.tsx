import type { Meta, StoryObj } from "@storybook/react";

import { Description } from "./description";
import { FieldError } from "./field-error";
import { Label } from "./label";
import { NumberField } from "./number-field";

const meta: Meta<typeof NumberField> = {
	title: "Forms/NumberField",
	component: NumberField,
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
type Story = StoryObj<typeof NumberField>;

export const Default: Story = {
	render: (args) => (
		<NumberField {...args}>
			<Label>Quantity</Label>
			<NumberField.Group>
				<NumberField.DecrementButton />
				<NumberField.Input />
				<NumberField.IncrementButton />
			</NumberField.Group>
		</NumberField>
	),
};

export const WithDescription: Story = {
	render: () => (
		<NumberField>
			<Label>Guests</Label>
			<NumberField.Group>
				<NumberField.DecrementButton />
				<NumberField.Input />
				<NumberField.IncrementButton />
			</NumberField.Group>
			<Description>Number of guests for the reservation</Description>
		</NumberField>
	),
};

export const WithMinMax: Story = {
	render: () => (
		<NumberField minValue={0} maxValue={10} defaultValue={5}>
			<Label>Rating</Label>
			<NumberField.Group>
				<NumberField.DecrementButton />
				<NumberField.Input />
				<NumberField.IncrementButton />
			</NumberField.Group>
			<Description>Rate from 0 to 10</Description>
		</NumberField>
	),
};

export const WithStep: Story = {
	render: () => (
		<NumberField step={5} defaultValue={0}>
			<Label>Volume</Label>
			<NumberField.Group>
				<NumberField.DecrementButton />
				<NumberField.Input />
				<NumberField.IncrementButton />
			</NumberField.Group>
			<Description>Increments by 5</Description>
		</NumberField>
	),
};

export const Currency: Story = {
	render: () => (
		<NumberField
			formatOptions={{
				style: "currency",
				currency: "USD",
			}}
			defaultValue={99.99}
		>
			<Label>Price</Label>
			<NumberField.Group>
				<NumberField.DecrementButton />
				<NumberField.Input />
				<NumberField.IncrementButton />
			</NumberField.Group>
		</NumberField>
	),
};

export const Percentage: Story = {
	render: () => (
		<NumberField
			formatOptions={{
				style: "percent",
			}}
			defaultValue={0.25}
			minValue={0}
			maxValue={1}
			step={0.01}
		>
			<Label>Discount</Label>
			<NumberField.Group>
				<NumberField.DecrementButton />
				<NumberField.Input />
				<NumberField.IncrementButton />
			</NumberField.Group>
		</NumberField>
	),
};

export const Invalid: Story = {
	render: () => (
		<NumberField isInvalid minValue={1} defaultValue={0}>
			<Label>Quantity</Label>
			<NumberField.Group>
				<NumberField.DecrementButton />
				<NumberField.Input />
				<NumberField.IncrementButton />
			</NumberField.Group>
			<FieldError>Quantity must be at least 1</FieldError>
		</NumberField>
	),
};

export const Disabled: Story = {
	render: () => (
		<NumberField isDisabled defaultValue={42}>
			<Label>Fixed Value</Label>
			<NumberField.Group>
				<NumberField.DecrementButton />
				<NumberField.Input />
				<NumberField.IncrementButton />
			</NumberField.Group>
		</NumberField>
	),
};

export const ReadOnly: Story = {
	render: () => (
		<NumberField isReadOnly defaultValue={100}>
			<Label>Stock Count</Label>
			<NumberField.Group>
				<NumberField.DecrementButton />
				<NumberField.Input />
				<NumberField.IncrementButton />
			</NumberField.Group>
			<Description>This value is read-only</Description>
		</NumberField>
	),
};

export const Required: Story = {
	render: () => (
		<NumberField isRequired>
			<Label>Age</Label>
			<NumberField.Group>
				<NumberField.DecrementButton />
				<NumberField.Input />
				<NumberField.IncrementButton />
			</NumberField.Group>
			<Description>Required field</Description>
		</NumberField>
	),
};

export const InputOnly: Story = {
	render: () => (
		<NumberField>
			<Label>Simple Number</Label>
			<NumberField.Input />
			<Description>Without increment/decrement buttons</Description>
		</NumberField>
	),
};
