import type { Meta, StoryObj } from "@storybook/react";
import type { TimeValue } from "react-aria-components";

import { Time } from "@internationalized/date";
import { useState } from "react";

import { Label } from "./label";
import { TimeField } from "./time-field";

const meta: Meta<typeof TimeField> = {
	title: "Date & Time/TimeField",
	component: TimeField,
};

export default meta;
type Story = StoryObj<typeof TimeField>;

function TimeFieldTemplate(props: TimeField.Props<TimeValue>) {
	return (
		<TimeField {...props}>
			<Label>Time</Label>
			<TimeField.Input />
		</TimeField>
	);
}

export const Default: Story = {
	render: (args) => <TimeFieldTemplate {...args} />,
};

export const Controlled: Story = {
	render: function ControlledTimeField() {
		let [value, setValue] = useState<TimeValue | null>(new Time(9, 30));
		return <TimeFieldTemplate value={value} onChange={setValue} />;
	},
};

export const DefaultValue: Story = {
	render: () => <TimeFieldTemplate defaultValue={new Time(14, 30)} />,
};

export const Disabled: Story = {
	render: () => <TimeFieldTemplate isDisabled defaultValue={new Time(9, 0)} />,
};

export const Invalid: Story = {
	render: () => <TimeFieldTemplate isInvalid defaultValue={new Time(9, 0)} />,
};

export const MinMaxTimes: Story = {
	render: () => <TimeFieldTemplate minValue={new Time(9, 0)} maxValue={new Time(17, 0)} />,
};

export const ReadOnly: Story = {
	render: () => <TimeFieldTemplate isReadOnly defaultValue={new Time(12, 0)} />,
};

export const Required: Story = {
	render: () => <TimeFieldTemplate isRequired />,
};

export const HourCycle12: Story = {
	render: () => <TimeFieldTemplate hourCycle={12} defaultValue={new Time(14, 30)} />,
};

export const HourCycle24: Story = {
	render: () => <TimeFieldTemplate hourCycle={24} defaultValue={new Time(14, 30)} />,
};

export const HideTimeZone: Story = {
	render: () => <TimeFieldTemplate hideTimeZone defaultValue={new Time(14, 30)} />,
};

export const GranularityHour: Story = {
	render: () => <TimeFieldTemplate granularity="hour" defaultValue={new Time(14, 0)} />,
};

export const GranularityMinute: Story = {
	render: () => <TimeFieldTemplate granularity="minute" defaultValue={new Time(14, 30)} />,
};

export const GranularitySecond: Story = {
	render: () => <TimeFieldTemplate granularity="second" defaultValue={new Time(14, 30, 45)} />,
};

export const WithDescription: Story = {
	render: () => (
		<TimeField>
			<Label>Time</Label>
			<TimeField.Input />
			<p className="text-sm text-neutral-500">Enter your preferred time</p>
		</TimeField>
	),
};
