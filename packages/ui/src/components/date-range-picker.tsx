/**
 * A paired-field date range control building on {@link DateField} for its
 * plain fallback — independent start-date and end-date fields, each fully
 * labeled, described, and validated on its own — extended with a
 * {@link DateRangePicker.Group} row and a trigger
 * {@link DateRangePicker.Button} for composing a
 * {@link DateRangePicker.Dialog} calendar surface alongside it. Leaving
 * `children` unset keeps the fallback pair on its own, complete and
 * keyboard-operable with no composed surface at all.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import { flex, flexCol, gap, items } from "@sdxc/u/layout";
import { attrs } from "remix/ui";

import { DateField } from "./date-field.js";
import { DatePicker } from "./date-picker.js";

/**
 * Prop types for {@link DateRangePicker} and its compound parts. The
 * {@link DateRangePicker.Group}, {@link DateRangePicker.Button}, and
 * {@link DateRangePicker.Dialog} parts alias {@link DatePicker}'s matching parts directly, since the trigger row and calendar surface render identically for a range as for a single date.
 */
export namespace DateRangePicker {
	/**
	 * Semantic color role for the fallback pair's keyboard focus rings. Read
	 * only by the fallback fields — {@link DateRangePicker.Group}'s composed
	 * control carries no `color` prop of its own.
	 */
	export type Color = DateField.Color;

	/**
	 * Per-part styling for the two {@link DateField} instances the fallback
	 * pair composes, each forwarded to that field's own `parts`. Read only
	 * when `children` is unset; the composed layout styles its own parts individually instead.
	 */
	export interface PartsProps {
		/** Per-part styling for the fallback pair's start-date field. */
		start?: DateField.PartsProps;
		/** Per-part styling for the fallback pair's end-date field. */
		end?: DateField.PartsProps;
	}

	/**
	 * Props accepted by {@link DateRangePicker}. Leaving `children` unset
	 * renders two independent {@link DateField} instances — one per end of
	 * the range — using every field below; composing {@link DateRangePicker.Group} and {@link DateRangePicker.Dialog} instead renders the richer layout and leaves every field below unread.
	 */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		/** Semantic color role for the fallback pair's focus rings. Read only when `children` is unset. */
		color?: Color;
		/** The start-date field's caption, rendered through {@link DateField}. Read only when `children` is unset. */
		startLabel?: RemixNode;
		/** The end-date field's caption, rendered through {@link DateField}. Read only when `children` is unset. */
		endLabel?: RemixNode;
		/** Supporting copy beneath the start-date field. Read only when `children` is unset. */
		startDescription?: RemixNode;
		/** Supporting copy beneath the end-date field. Read only when `children` is unset. */
		endDescription?: RemixNode;
		/** Validation message beneath the start-date field. Read only when `children` is unset. */
		startErrorMessage?: RemixNode;
		/** Validation message beneath the end-date field. Read only when `children` is unset. */
		endErrorMessage?: RemixNode;
		/** Native `name` submitted with an enclosing form for the start-date field. */
		startName?: string;
		/** Native `name` submitted with an enclosing form for the end-date field. */
		endName?: string;
		/** Current start-of-range value, in `YYYY-MM-DD` form, for a fallback pair a consumer tracks itself. */
		startValue?: string;
		/** Current end-of-range value, in `YYYY-MM-DD` form, for a fallback pair a consumer tracks itself. */
		endValue?: string;
		/** Initial start-of-range value, in `YYYY-MM-DD` form, for a fallback pair left to the platform's own uncontrolled state. */
		startDefaultValue?: string;
		/** Initial end-of-range value, in `YYYY-MM-DD` form, for a fallback pair left to the platform's own uncontrolled state. */
		endDefaultValue?: string;
		/** Earliest accepted date, in `YYYY-MM-DD` form, read by both of the fallback pair's fields. */
		min?: string;
		/** Latest accepted date, in `YYYY-MM-DD` form, read by both of the fallback pair's fields. */
		max?: string;
		/** Granularity, in days, both of the fallback pair's values must fall on. */
		step?: number;
		/** Marks both of the fallback pair's fields required for their enclosing form. */
		required?: boolean;
		/** Marks both of the fallback pair's fields inert and excluded from the tab order. */
		disabled?: boolean;
		/** Marks both of the fallback pair's fields' values fixed, while keeping them focusable and included in form submission. */
		readOnly?: boolean;
		/** Native autofill hint for both of the fallback pair's fields. */
		autoComplete?: string;
		/** Per-part styling for the fallback pair's internally composed {@link DateField} instances. Read only when `children` is unset. */
		parts?: PartsProps;
		/**
		 * The trigger-and-calendar layout — typically a `Label`,
		 * {@link DateRangePicker.Group}, and {@link DateRangePicker.Dialog} —
		 * rendered in place of the paired fallback fields, leaving every field above unread when set.
		 */
		children?: RemixNode;
	}

	/**
	 * Every prop {@link DatePicker.GroupProps} accepts, unchanged. `children`
	 * composes the range's own start and end controls and
	 * {@link DateRangePicker.Button} into one visual row.
	 */
	export interface GroupProps extends DatePicker.GroupProps {}

	/** Every prop {@link DatePicker.ButtonProps} accepts, unchanged. */
	export interface ButtonProps extends DatePicker.ButtonProps {}

	/** Every prop {@link DatePicker.DialogProps} accepts, unchanged. */
	export interface DialogProps extends DatePicker.DialogProps {}
}

/**
 * Renders {@link DateRangePicker}'s root. Leaving `children` unset renders
 * two independent {@link DateField} instances side by side under a native
 * `role="group"`, each aligned to its own start edge so a validation message under one never shifts the other's label; composing {@link DateRangePicker.Group} and {@link DateRangePicker.Dialog} as `children` instead renders the richer layout and leaves every field above unread.
 *
 * @param handle Runtime handle carrying the root element's props.
 * @returns The render function producing the date range picker's markup.
 * @example
 * <DateRangePicker
 * 	startLabel={t("form.stay.checkIn")}
 * 	endLabel={t("form.stay.checkOut")}
 * 	startName="checkIn"
 * 	endName="checkOut"
 * />
 * @example
 * <DateRangePicker>
 * 	<Label htmlFor="tripStart">{t("form.trip.label")}</Label>
 * 	<DateRangePicker.Group>
 * 		<Input id="tripStart" type="date" name="tripStart" />
 * 		<Input id="tripEnd" type="date" name="tripEnd" />
 * 		<DateRangePicker.Button
 * 			commandfor="trip-calendar"
 * 			command="toggle-popover"
 * 			aria-label={t("form.trip.toggle")}
 * 		/>
 * 	</DateRangePicker.Group>
 * 	<DateRangePicker.Dialog id="trip-calendar">
 * 		<RangeCalendar aria-label={monthLabel}>
 * 			<RangeCalendar.Header>
 * 				<RangeCalendar.PreviousButton aria-label={t("calendar.previous")} />
 * 				<RangeCalendar.Heading>{monthLabel}</RangeCalendar.Heading>
 * 				<RangeCalendar.NextButton aria-label={t("calendar.next")} />
 * 			</RangeCalendar.Header>
 * 			<RangeCalendar.Grid aria-label={monthLabel}>...</RangeCalendar.Grid>
 * 		</RangeCalendar>
 * 	</DateRangePicker.Dialog>
 * </DateRangePicker>
 */
export function DateRangePicker(handle: Handle<DateRangePicker.Props>) {
	return () => {
		let {
			color,
			startLabel,
			endLabel,
			startDescription,
			endDescription,
			startErrorMessage,
			endErrorMessage,
			startName,
			endName,
			startValue,
			endValue,
			startDefaultValue,
			endDefaultValue,
			min,
			max,
			step,
			required,
			disabled,
			readOnly,
			autoComplete,
			parts,
			children,
			mix,
			...rest
		} = handle.props;

		if (import.meta.env.DEV && !children) {
			if (!startLabel) {
				console.warn(
					'DateRangePicker: falling back to paired "input type=date" fields needs a "startLabel" describing the range\'s start for assistive technology.',
				);
			}
			if (!endLabel) {
				console.warn(
					'DateRangePicker: falling back to paired "input type=date" fields needs an "endLabel" describing the range\'s end for assistive technology.',
				);
			}
		}

		if (!children) {
			return (
				<div
					{...rest}
					data-slot="fields"
					mix={[attrs({ role: "group" }), flex(), gap(2), items("start"), mix]}
				>
					<DateField
						color={color}
						label={startLabel}
						description={startDescription}
						errorMessage={startErrorMessage}
						name={startName}
						value={startValue}
						defaultValue={startDefaultValue}
						min={min}
						max={max}
						step={step}
						required={required}
						disabled={disabled}
						readOnly={readOnly}
						autoComplete={autoComplete}
						parts={parts?.start}
					/>
					<DateField
						color={color}
						label={endLabel}
						description={endDescription}
						errorMessage={endErrorMessage}
						name={endName}
						value={endValue}
						defaultValue={endDefaultValue}
						min={min}
						max={max}
						step={step}
						required={required}
						disabled={disabled}
						readOnly={readOnly}
						autoComplete={autoComplete}
						parts={parts?.end}
					/>
				</div>
			);
		}

		return (
			<div {...rest} data-slot="date-range-picker" mix={[flex(), flexCol(), gap(1), mix]}>
				{children}
			</div>
		);
	};
}

/**
 * Renders {@link DateRangePicker}'s control row: identical to
 * {@link DatePicker.Group}'s markup and focus-within outline. `children`
 * composes the range's start and end controls with {@link DateRangePicker.Button}, and the row gains a keyboard focus ring whenever focus lands anywhere inside it.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the row's markup.
 * @example
 * <DateRangePicker.Group>
 * 	<Input id="tripStart" type="date" name="tripStart" />
 * 	<Input id="tripEnd" type="date" name="tripEnd" />
 * 	<DateRangePicker.Button commandfor="trip-calendar" command="toggle-popover" aria-label={t("form.trip.toggle")} />
 * </DateRangePicker.Group>
 */
DateRangePicker.Group = DatePicker.Group;

/**
 * Renders {@link DateRangePicker}'s trailing trigger: identical to
 * {@link DatePicker.Button}'s calendar glyph and hover/focus-visible
 * styling. Point `commandfor` at {@link DateRangePicker.Dialog}'s `id` with `command="toggle-popover"` to wire it up as that surface's invoker.
 *
 * @param handle Runtime handle carrying the host `<button>`'s props.
 * @returns The render function producing the trigger's markup.
 * @example
 * <DateRangePicker.Button commandfor="trip-calendar" command="toggle-popover" aria-label={t("form.trip.toggle")} />
 */
DateRangePicker.Button = DatePicker.Button;

/**
 * Renders {@link DateRangePicker}'s calendar surface: identical to
 * {@link DatePicker.Dialog}'s placement default, padding, and
 * `role="dialog"`, with only the calendar a consumer composes as `children` differing. {@link DateRangePicker.Button}'s `commandfor`/`command="toggle-popover"` both opens this surface and becomes its implicit CSS anchor; pair a `calendarKeys()`/`rangePreview()` mixin on the composed calendar for a live, arrow-key- or drag-extended range.
 *
 * @param handle Runtime handle carrying the host's {@link Popover} props.
 * @returns The render function producing the surface's markup.
 * @example
 * <DateRangePicker.Dialog id="trip-calendar">
 * 	<RangeCalendar aria-label={monthLabel}>
 * 		<RangeCalendar.Header>
 * 			<RangeCalendar.PreviousButton aria-label={t("calendar.previous")} />
 * 			<RangeCalendar.Heading>{monthLabel}</RangeCalendar.Heading>
 * 			<RangeCalendar.NextButton aria-label={t("calendar.next")} />
 * 		</RangeCalendar.Header>
 * 		<RangeCalendar.Grid aria-label={monthLabel}>...</RangeCalendar.Grid>
 * 	</RangeCalendar>
 * </DateRangePicker.Dialog>
 */
DateRangePicker.Dialog = DatePicker.Dialog;
