import type { Meta, StoryObj } from "@storybook/react";
import type { DateValue } from "react-aria-components";

import { getLocalTimeZone, today } from "@internationalized/date";
import { useState } from "react";

import { Calendar } from "./calendar";

const meta: Meta<typeof Calendar> = {
	title: "Date & Time/Calendar",
	component: Calendar,
};

export default meta;
type Story = StoryObj<typeof Calendar>;

function CalendarTemplate(props: Calendar.Props<DateValue>) {
	return (
		<Calendar {...props}>
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
	);
}

export const Default: Story = {
	render: (args) => <CalendarTemplate {...args} />,
};

export const Controlled: Story = {
	render: function ControlledCalendar() {
		let [value, setValue] = useState<DateValue>(today(getLocalTimeZone()));
		return <CalendarTemplate value={value} onChange={setValue} />;
	},
};

export const DefaultValue: Story = {
	render: () => <CalendarTemplate defaultValue={today(getLocalTimeZone())} />,
};

export const Disabled: Story = {
	render: () => <CalendarTemplate isDisabled />,
};

export const Invalid: Story = {
	render: () => <CalendarTemplate isInvalid defaultValue={today(getLocalTimeZone())} />,
};

export const MinMaxDates: Story = {
	render: () => {
		let now = today(getLocalTimeZone());
		return <CalendarTemplate minValue={now} maxValue={now.add({ weeks: 2 })} />;
	},
};

export const ReadOnly: Story = {
	render: () => <CalendarTemplate isReadOnly defaultValue={today(getLocalTimeZone())} />,
};

export const UnavailableDates: Story = {
	render: () => {
		let now = today(getLocalTimeZone());
		return (
			<CalendarTemplate
				defaultValue={now}
				isDateUnavailable={(date) => date.day === 15 || date.day === 20}
			/>
		);
	},
};
