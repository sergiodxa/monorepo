import type { Meta, StoryObj } from "@storybook/react";
import type { DateValue, RangeValue } from "react-aria-components";

import { getLocalTimeZone, today } from "@internationalized/date";
import { useState } from "react";

import { Calendar } from "./calendar";
import { DateRangePicker } from "./date-range-picker";
import { Label } from "./label";
import { Popover } from "./popover";
import { RangeCalendar } from "./range-calendar";

const meta: Meta<typeof DateRangePicker> = {
	title: "Date & Time/DateRangePicker",
	component: DateRangePicker,
};

export default meta;
type Story = StoryObj<typeof DateRangePicker>;

function DateRangePickerTemplate(props: DateRangePicker.Props<DateValue>) {
	return (
		<DateRangePicker {...props}>
			<Label>Date Range</Label>
			<DateRangePicker.Group>
				<DateRangePicker.StartInput />
				<span aria-hidden="true">-</span>
				<DateRangePicker.EndInput />
				<DateRangePicker.Button />
			</DateRangePicker.Group>
			<Popover>
				<DateRangePicker.Dialog>
					<RangeCalendar>
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
				</DateRangePicker.Dialog>
			</Popover>
		</DateRangePicker>
	);
}

export const Default: Story = {
	render: (args) => <DateRangePickerTemplate {...args} />,
};

export const Controlled: Story = {
	render: function ControlledDateRangePicker() {
		let now = today(getLocalTimeZone());
		let [value, setValue] = useState<RangeValue<DateValue> | null>({
			start: now,
			end: now.add({ weeks: 1 }),
		});
		return <DateRangePickerTemplate value={value} onChange={setValue} />;
	},
};

export const DefaultValue: Story = {
	render: () => {
		let now = today(getLocalTimeZone());
		return (
			<DateRangePickerTemplate
				defaultValue={{
					start: now,
					end: now.add({ weeks: 1 }),
				}}
			/>
		);
	},
};

export const Disabled: Story = {
	render: () => {
		let now = today(getLocalTimeZone());
		return (
			<DateRangePickerTemplate
				isDisabled
				defaultValue={{
					start: now,
					end: now.add({ weeks: 1 }),
				}}
			/>
		);
	},
};

export const Invalid: Story = {
	render: () => {
		let now = today(getLocalTimeZone());
		return (
			<DateRangePickerTemplate
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
		return <DateRangePickerTemplate minValue={now} maxValue={now.add({ months: 2 })} />;
	},
};

export const ReadOnly: Story = {
	render: () => {
		let now = today(getLocalTimeZone());
		return (
			<DateRangePickerTemplate
				isReadOnly
				defaultValue={{
					start: now,
					end: now.add({ weeks: 1 }),
				}}
			/>
		);
	},
};

export const Required: Story = {
	render: () => <DateRangePickerTemplate isRequired />,
};

export const WithDescription: Story = {
	render: () => {
		return (
			<DateRangePicker>
				<Label>Date Range</Label>
				<DateRangePicker.Group>
					<DateRangePicker.StartInput />
					<span aria-hidden="true">-</span>
					<DateRangePicker.EndInput />
					<DateRangePicker.Button />
				</DateRangePicker.Group>
				<p className="text-sm text-neutral-500">Select the start and end dates for your trip</p>
				<Popover>
					<DateRangePicker.Dialog>
						<RangeCalendar>
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
					</DateRangePicker.Dialog>
				</Popover>
			</DateRangePicker>
		);
	},
};
