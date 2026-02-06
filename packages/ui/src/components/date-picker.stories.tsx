import type { Meta, StoryObj } from "@storybook/react";
import type { DateValue } from "react-aria-components";

import { getLocalTimeZone, today } from "@internationalized/date";
import { useState } from "react";
import { Dialog } from "react-aria-components";

import { Calendar } from "./calendar";
import { DateField } from "./date-field";
import { DatePicker } from "./date-picker";
import { Label } from "./label";
import { Popover } from "./popover";

const meta: Meta<typeof DatePicker> = {
	title: "Date & Time/DatePicker",
	component: DatePicker,
};

export default meta;
type Story = StoryObj<typeof DatePicker>;

function DatePickerTemplate(props: DatePicker.Props<DateValue>) {
	return (
		<DatePicker {...props}>
			<Label>Date</Label>
			<DatePicker.Group>
				<DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
				<DatePicker.Button />
			</DatePicker.Group>
			<Popover>
				<Dialog>
					<Calendar>
						<Calendar.Header>
							<Calendar.PreviousButton />
							<Calendar.Heading />
							<Calendar.NextButton />
						</Calendar.Header>
						<Calendar.Grid>
							<Calendar.GridHeader>
								{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
							</Calendar.GridHeader>
							<Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
						</Calendar.Grid>
					</Calendar>
				</Dialog>
			</Popover>
		</DatePicker>
	);
}

export const Default: Story = {
	render: (args) => <DatePickerTemplate {...args} />,
};

export const Controlled: Story = {
	render: function ControlledDatePicker() {
		let [value, setValue] = useState<DateValue | null>(today(getLocalTimeZone()));
		return <DatePickerTemplate value={value} onChange={setValue} />;
	},
};

export const DefaultValue: Story = {
	render: () => <DatePickerTemplate defaultValue={today(getLocalTimeZone())} />,
};

export const Disabled: Story = {
	render: () => <DatePickerTemplate isDisabled defaultValue={today(getLocalTimeZone())} />,
};

export const Invalid: Story = {
	render: () => <DatePickerTemplate isInvalid defaultValue={today(getLocalTimeZone())} />,
};

export const MinMaxDates: Story = {
	render: () => {
		let now = today(getLocalTimeZone());
		return <DatePickerTemplate minValue={now} maxValue={now.add({ months: 1 })} />;
	},
};

export const ReadOnly: Story = {
	render: () => <DatePickerTemplate isReadOnly defaultValue={today(getLocalTimeZone())} />,
};

export const Required: Story = {
	render: () => <DatePickerTemplate isRequired />,
};

export const WithDescription: Story = {
	render: () => (
		<DatePicker>
			<Label>Date</Label>
			<DatePicker.Group>
				<DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
				<DatePicker.Button />
			</DatePicker.Group>
			<p className="text-sm text-neutral-500">Select a date for your appointment</p>
			<Popover>
				<Dialog>
					<Calendar>
						<Calendar.Header>
							<Calendar.PreviousButton />
							<Calendar.Heading />
							<Calendar.NextButton />
						</Calendar.Header>
						<Calendar.Grid>
							<Calendar.GridHeader>
								{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
							</Calendar.GridHeader>
							<Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
						</Calendar.Grid>
					</Calendar>
				</Dialog>
			</Popover>
		</DatePicker>
	),
};
