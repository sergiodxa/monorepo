import type { Meta, StoryObj } from "@storybook/react";
import type { DateValue } from "react-aria-components";

import { getLocalTimeZone, today } from "@internationalized/date";
import { useState } from "react";

import { DateField } from "./date-field";
import { Label } from "./label";

const meta: Meta<typeof DateField> = {
	title: "Date & Time/DateField",
	component: DateField,
};

export default meta;
type Story = StoryObj<typeof DateField>;

function DateFieldTemplate(props: DateField.Props<DateValue>) {
	return (
		<DateField {...props}>
			<Label>Date</Label>
			<DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
		</DateField>
	);
}

export const Default: Story = {
	render: (args) => <DateFieldTemplate {...args} />,
};

export const Controlled: Story = {
	render: function ControlledDateField() {
		let [value, setValue] = useState<DateValue | null>(today(getLocalTimeZone()));
		return <DateFieldTemplate value={value} onChange={setValue} />;
	},
};

export const DefaultValue: Story = {
	render: () => <DateFieldTemplate defaultValue={today(getLocalTimeZone())} />,
};

export const Disabled: Story = {
	render: () => <DateFieldTemplate isDisabled defaultValue={today(getLocalTimeZone())} />,
};

export const Invalid: Story = {
	render: () => <DateFieldTemplate isInvalid defaultValue={today(getLocalTimeZone())} />,
};

export const MinMaxDates: Story = {
	render: () => {
		let now = today(getLocalTimeZone());
		return <DateFieldTemplate minValue={now} maxValue={now.add({ months: 1 })} />;
	},
};

export const ReadOnly: Story = {
	render: () => <DateFieldTemplate isReadOnly defaultValue={today(getLocalTimeZone())} />,
};

export const Required: Story = {
	render: () => <DateFieldTemplate isRequired />,
};

export const WithDescription: Story = {
	render: () => (
		<DateField>
			<Label>Date</Label>
			<DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
			<p className="text-sm text-neutral-500">Enter your preferred date</p>
		</DateField>
	),
};
