import type { Meta, StoryObj } from "@storybook/react";
import type { DateValue, RangeValue } from "react-aria-components";

import { getLocalTimeZone, today } from "@internationalized/date";
import { useState } from "react";

import { Calendar } from "./calendar";
import { RangeCalendar } from "./range-calendar";

const meta: Meta<typeof RangeCalendar> = {
	title: "Date & Time/RangeCalendar",
	component: RangeCalendar,
};

export default meta;
type Story = StoryObj<typeof RangeCalendar>;

function RangeCalendarTemplate(props: RangeCalendar.Props<DateValue>) {
	return (
		<RangeCalendar {...props}>
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
		</RangeCalendar>
	);
}

export const Default: Story = {
	render: (args) => <RangeCalendarTemplate {...args} />,
};

export const Controlled: Story = {
	render: function ControlledRangeCalendar() {
		let now = today(getLocalTimeZone());
		let [value, setValue] = useState<RangeValue<DateValue>>({
			start: now,
			end: now.add({ weeks: 1 }),
		});
		return <RangeCalendarTemplate value={value} onChange={setValue} />;
	},
};

export const DefaultValue: Story = {
	render: () => {
		let now = today(getLocalTimeZone());
		return (
			<RangeCalendarTemplate
				defaultValue={{
					start: now,
					end: now.add({ weeks: 1 }),
				}}
			/>
		);
	},
};

export const Disabled: Story = {
	render: () => <RangeCalendarTemplate isDisabled />,
};

export const Invalid: Story = {
	render: () => {
		let now = today(getLocalTimeZone());
		return (
			<RangeCalendarTemplate
				isInvalid
				defaultValue={{
					start: now,
					end: now.add({ weeks: 1 }),
				}}
			/>
		);
	},
};

export const MinMaxDates: Story = {
	render: () => {
		let now = today(getLocalTimeZone());
		return <RangeCalendarTemplate minValue={now} maxValue={now.add({ months: 1 })} />;
	},
};

export const ReadOnly: Story = {
	render: () => {
		let now = today(getLocalTimeZone());
		return (
			<RangeCalendarTemplate
				isReadOnly
				defaultValue={{
					start: now,
					end: now.add({ weeks: 1 }),
				}}
			/>
		);
	},
};

export const UnavailableDates: Story = {
	render: () => {
		let now = today(getLocalTimeZone());
		return (
			<RangeCalendarTemplate
				defaultValue={{
					start: now,
					end: now.add({ days: 5 }),
				}}
				isDateUnavailable={(date) => date.day === 15 || date.day === 20}
			/>
		);
	},
};
