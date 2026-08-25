/**
 * A calendar surface for choosing a start and end date as one connected
 * range, sharing every header, grid, and row part with {@link Calendar} and
 * layering range position on top of its day cell. Used bare, with no
 * composed children, it renders a pair of native `<input type="date">`
 * fields instead — start and end, each independently keyboard-operable —
 * ready for the `calendarKeys()`/`rangePreview()` mixins a consumer attaches
 * to turn the composed grid into a live, drag- or arrow-key-extended range.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { bg, fg } from "@pkg/u/color";
import { roundedCorner } from "@pkg/u/effects";
import { flex, gap, items } from "@pkg/u/layout";
import { data, when } from "@pkg/u/state";
import { attrs } from "remix/ui";

import { Calendar } from "./calendar";
import { Input } from "./input";

/** Semantic color role {@link RangeCalendar}'s bare fallback pair falls back to when `color` is omitted. */
const DEFAULT_COLOR: RangeCalendar.Color = "neutral";

/**
 * Prop types for {@link RangeCalendar} and its compound parts. Every part
 * but {@link RangeCalendar.Cell} aliases {@link Calendar}'s matching part,
 * sharing its header, grid, and row markup.
 */
export namespace RangeCalendar {
	/**
	 * Semantic color role for the bare fallback pair's keyboard focus rings,
	 * mapped to `--ui-*` variables like {@link Calendar.Color}. The composed
	 * grid's day cells always use fixed semantic roles, regardless of this value.
	 */
	export type Color = Calendar.Color;

	/**
	 * Per-part styling for the bare fallback pair's two internally composed
	 * inputs, layered after each input's own built-in styling. Style the
	 * composed grid's parts through {@link Calendar}'s own compound parts.
	 */
	export interface PartsProps {
		/** Styling for the bare fallback's start-date input, rendered through {@link Input}. */
		start?: TagProps<"input">["mix"];
		/** Styling for the bare fallback's end-date input, rendered through {@link Input}. */
		end?: TagProps<"input">["mix"];
	}

	/**
	 * Props accepted by {@link RangeCalendar}. Composing
	 * {@link RangeCalendar.Header} and {@link RangeCalendar.Grid} as `children`
	 * renders the visual month surface; omitting `children` renders a bare native `<input type="date">` pair from the fields below.
	 */
	export interface Props extends TagProps<"div"> {
		/** Semantic color role for the bare fallback pair's focus rings. Defaults to {@link DEFAULT_COLOR}. */
		color?: Color;
		/** Native `name` submitted with an enclosing form, read only by the bare fallback's start-date input. */
		startName?: string;
		/** Native `name` submitted with an enclosing form, read only by the bare fallback's end-date input. */
		endName?: string;
		/** Current start-of-range value, in `YYYY-MM-DD` form, for a bare fallback pair a consumer tracks itself. */
		startValue?: string;
		/** Current end-of-range value, in `YYYY-MM-DD` form, for a bare fallback pair a consumer tracks itself. */
		endValue?: string;
		/** Initial start-of-range value, in `YYYY-MM-DD` form, for a bare fallback pair left to the platform's own uncontrolled state. */
		startDefaultValue?: string;
		/** Initial end-of-range value, in `YYYY-MM-DD` form, for a bare fallback pair left to the platform's own uncontrolled state. */
		endDefaultValue?: string;
		/** Earliest accepted date, in `YYYY-MM-DD` form, read by both of the bare fallback pair's inputs. */
		min?: string;
		/** Latest accepted date, in `YYYY-MM-DD` form, read by both of the bare fallback pair's inputs. */
		max?: string;
		/** Granularity, in days, both of the bare fallback pair's values must fall on. */
		step?: number;
		/** Marks both of the bare fallback pair's inputs required for their enclosing form. */
		required?: boolean;
		/** Marks both of the bare fallback pair's inputs inert and excluded from the tab order. */
		disabled?: boolean;
		/** Marks both of the bare fallback pair's inputs' values fixed, while keeping them focusable and included in form submission. */
		readOnly?: boolean;
		/** Native autofill hint for both of the bare fallback pair's inputs, e.g. `"bday"`. */
		autoComplete?: string;
		/** Accessible label for the bare fallback pair's start-date input. Read only when `children` is unset. */
		startLabel?: string;
		/** Accessible label for the bare fallback pair's end-date input. Read only when `children` is unset. */
		endLabel?: string;
		/** Per-part styling for the bare fallback pair's internally composed inputs. */
		parts?: PartsProps;
	}

	/** Every prop {@link Calendar.HeaderProps} accepts, unchanged. */
	export interface HeaderProps extends Calendar.HeaderProps {}

	/** Every prop {@link Calendar.PreviousButtonProps} accepts, unchanged. */
	export interface PreviousButtonProps extends Calendar.PreviousButtonProps {}

	/** Every prop {@link Calendar.NextButtonProps} accepts, unchanged. */
	export interface NextButtonProps extends Calendar.NextButtonProps {}

	/** Every prop {@link Calendar.HeadingProps} accepts, unchanged. */
	export interface HeadingProps extends Calendar.HeadingProps {}

	/** Every prop {@link Calendar.GridProps} accepts, unchanged. */
	export interface GridProps extends Calendar.GridProps {}

	/** Every prop {@link Calendar.GridHeaderProps} accepts, unchanged. */
	export interface GridHeaderProps extends Calendar.GridHeaderProps {}

	/** Every prop {@link Calendar.RowProps} accepts, unchanged. */
	export interface RowProps extends Calendar.RowProps {}

	/** Every prop {@link Calendar.HeaderCellProps} accepts, unchanged. */
	export interface HeaderCellProps extends Calendar.HeaderCellProps {}

	/** Every prop {@link Calendar.GridBodyProps} accepts, unchanged. */
	export interface GridBodyProps extends Calendar.GridBodyProps {}

	/**
	 * Every prop {@link Calendar.CellProps} accepts, unchanged. Set
	 * `data-selection-start` on the range's first day, `data-selection-end`
	 * on its last, and `aria-selected="true"` alone on the days between — each read straight off what the consumer sets on this instance.
	 */
	export interface CellProps extends Calendar.CellProps {}
}

/**
 * Renders {@link RangeCalendar}'s root through {@link Calendar}. Composing
 * {@link RangeCalendar.Header} and {@link RangeCalendar.Grid} as `children`
 * renders the visual month surface; omitting `children` renders a bare, script-free native `<input type="date">` pair from this instance's own fields.
 *
 * @param handle Runtime handle carrying the root element's props.
 * @returns The render function producing the range calendar's markup.
 * @example
 * <RangeCalendar startLabel={t("form.stay.checkIn")} endLabel={t("form.stay.checkOut")} startName="checkIn" endName="checkOut" />
 * @example
 * <RangeCalendar aria-label={t("calendar.label")}>
 * 	<RangeCalendar.Header>
 * 		<RangeCalendar.PreviousButton aria-label={t("calendar.previous")} />
 * 		<RangeCalendar.Heading>{monthLabel}</RangeCalendar.Heading>
 * 		<RangeCalendar.NextButton aria-label={t("calendar.next")} />
 * 	</RangeCalendar.Header>
 * 	<RangeCalendar.Grid aria-label={monthLabel}>
 * 		<RangeCalendar.GridHeader>
 * 			<RangeCalendar.Row>
 * 				{weekdayLabels.map((day) => (
 * 					<RangeCalendar.HeaderCell key={day}>{day}</RangeCalendar.HeaderCell>
 * 				))}
 * 			</RangeCalendar.Row>
 * 		</RangeCalendar.GridHeader>
 * 		<RangeCalendar.GridBody>
 * 			{weeks.map((week) => (
 * 				<RangeCalendar.Row key={week[0].iso}>
 * 					{week.map((day) => (
 * 						<RangeCalendar.Cell
 * 							key={day.iso}
 * 							aria-selected={day.inRange ? "true" : undefined}
 * 							data-selection-start={day.iso === range.start ? "" : undefined}
 * 							data-selection-end={day.iso === range.end ? "" : undefined}
 * 						>
 * 							{day.label}
 * 						</RangeCalendar.Cell>
 * 					))}
 * 				</RangeCalendar.Row>
 * 			))}
 * 		</RangeCalendar.GridBody>
 * 	</RangeCalendar.Grid>
 * </RangeCalendar>
 */
export function RangeCalendar(handle: Handle<RangeCalendar.Props>) {
	return () => {
		let {
			color,
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
			startLabel,
			endLabel,
			parts,
			children,
			mix,
			...rest
		} = handle.props;
		let resolvedColor = color ?? DEFAULT_COLOR;

		if (import.meta.env.DEV && !children) {
			if (!startLabel) {
				console.warn(
					'RangeCalendar: falling back to a plain "input type=date" pair needs a "startLabel" describing the range\'s start for assistive technology.',
				);
			}
			if (!endLabel) {
				console.warn(
					'RangeCalendar: falling back to a plain "input type=date" pair needs an "endLabel" describing the range\'s end for assistive technology.',
				);
			}
		}

		return (
			<Calendar {...rest} mix={mix}>
				{children ?? (
					<div
						data-slot="fields"
						mix={[attrs({ role: "group" }), flex(), items("center"), gap("0.5rem")]}
					>
						<Input
							type="date"
							data-slot="start-input"
							color={resolvedColor}
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
							aria-label={startLabel}
							mix={parts?.start}
						/>
						<Input
							type="date"
							data-slot="end-input"
							color={resolvedColor}
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
							aria-label={endLabel}
							mix={parts?.end}
						/>
					</div>
				)}
			</Calendar>
		);
	};
}

/**
 * Renders {@link RangeCalendar.HeaderProps.children} as the nav row: identical
 * to {@link Calendar.Header}, since {@link RangeCalendar} reuses
 * {@link Calendar}'s grid markup for its own header.
 *
 * @param handle Runtime handle carrying the host `<header>`'s props.
 * @returns The render function producing the nav row's markup.
 * @example
 * <RangeCalendar.Header>
 * 	<RangeCalendar.PreviousButton aria-label={t("calendar.previous")} />
 * 	<RangeCalendar.Heading>{monthLabel}</RangeCalendar.Heading>
 * 	<RangeCalendar.NextButton aria-label={t("calendar.next")} />
 * </RangeCalendar.Header>
 */
RangeCalendar.Header = Calendar.Header;

/**
 * Renders a control standing for "show the previous month": identical to
 * {@link Calendar.PreviousButton}.
 *
 * @param handle Runtime handle carrying the host `<button>`'s props.
 * @returns The render function producing the control's markup.
 * @example
 * <RangeCalendar.PreviousButton aria-label={t("calendar.previous")} />
 */
RangeCalendar.PreviousButton = Calendar.PreviousButton;

/**
 * Renders a control standing for "show the following month": identical to
 * {@link Calendar.NextButton}.
 *
 * @param handle Runtime handle carrying the host `<button>`'s props.
 * @returns The render function producing the control's markup.
 * @example
 * <RangeCalendar.NextButton aria-label={t("calendar.next")} />
 */
RangeCalendar.NextButton = Calendar.NextButton;

/**
 * Renders the calendar's visible month/year caption: identical to
 * {@link Calendar.Heading}.
 *
 * @param handle Runtime handle carrying the host heading element's props.
 * @returns The render function producing the caption's markup.
 * @example
 * <RangeCalendar.Heading>{monthLabel}</RangeCalendar.Heading>
 */
RangeCalendar.Heading = Calendar.Heading;

/**
 * Renders the day grid's native `<table>` host: identical to
 * {@link Calendar.Grid}.
 *
 * @param handle Runtime handle carrying the host `<table>`'s props.
 * @returns The render function producing the grid's markup.
 * @example
 * <RangeCalendar.Grid aria-label={monthLabel}>
 * 	<RangeCalendar.GridHeader>...</RangeCalendar.GridHeader>
 * 	<RangeCalendar.GridBody>...</RangeCalendar.GridBody>
 * </RangeCalendar.Grid>
 */
RangeCalendar.Grid = Calendar.Grid;

/**
 * Renders the grid's `<thead>` host: identical to {@link Calendar.GridHeader}.
 *
 * @param handle Runtime handle carrying the host `<thead>`'s props.
 * @returns The render function producing the header section's markup.
 * @example
 * <RangeCalendar.GridHeader>
 * 	<RangeCalendar.Row>
 * 		<RangeCalendar.HeaderCell>{t("calendar.weekdays.sun")}</RangeCalendar.HeaderCell>
 * 	</RangeCalendar.Row>
 * </RangeCalendar.GridHeader>
 */
RangeCalendar.GridHeader = Calendar.GridHeader;

/**
 * Renders a native `<tr>` host: identical to {@link Calendar.Row}. Composes
 * a row of {@link RangeCalendar.HeaderCell} inside
 * {@link RangeCalendar.GridHeader}, or a week's row of {@link RangeCalendar.Cell} inside {@link RangeCalendar.GridBody}.
 *
 * @param handle Runtime handle carrying the host `<tr>`'s props.
 * @returns The render function producing the row's markup.
 * @example
 * <RangeCalendar.Row>
 * 	<RangeCalendar.Cell>{day.label}</RangeCalendar.Cell>
 * </RangeCalendar.Row>
 */
RangeCalendar.Row = Calendar.Row;

/**
 * Renders a weekday abbreviation: identical to {@link Calendar.HeaderCell}.
 *
 * @param handle Runtime handle carrying the host `<th>`'s props.
 * @returns The render function producing the weekday header's markup.
 * @example
 * <RangeCalendar.HeaderCell>{t("calendar.weekdays.sun")}</RangeCalendar.HeaderCell>
 */
RangeCalendar.HeaderCell = Calendar.HeaderCell;

/**
 * Renders the grid's `<tbody>` host: identical to {@link Calendar.GridBody}.
 *
 * @param handle Runtime handle carrying the host `<tbody>`'s props.
 * @returns The render function producing the body section's markup.
 * @example
 * <RangeCalendar.GridBody>
 * 	{weeks.map((week) => (
 * 		<RangeCalendar.Row key={week[0].iso}>...</RangeCalendar.Row>
 * 	))}
 * </RangeCalendar.GridBody>
 */
RangeCalendar.GridBody = Calendar.GridBody;

/**
 * Renders one calendar day for {@link RangeCalendar}, building on
 * {@link Calendar.Cell}. `data-selection-start`/`data-selection-end`
 * square off each end's outer corners so the range reads as one unbroken bar, driven by whatever state the consumer sets for the `calendarKeys()`/`rangePreview()` mixins.
 *
 * @param handle Runtime handle carrying the host `<td>`'s props.
 * @returns The render function producing the day's markup.
 * @example
 * <RangeCalendar.Cell data-selection-start="">{day.label}</RangeCalendar.Cell>
 * @example
 * <RangeCalendar.Cell aria-selected="true">{day.label}</RangeCalendar.Cell>
 * @example
 * <RangeCalendar.Cell data-selection-end="">{day.label}</RangeCalendar.Cell>
 */
RangeCalendar.Cell = function RangeCalendarCell(handle: Handle<RangeCalendar.CellProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<Calendar.Cell
				{...rest}
				mix={[
					data("selection-start", [
						bg("brand.solid"),
						fg("brand.onSolid"),
						roundedCorner("start-end", "none"),
						roundedCorner("end-end", "none"),
					]),
					data("selection-end", [
						bg("brand.solid"),
						fg("brand.onSolid"),
						roundedCorner("start-start", "none"),
						roundedCorner("end-start", "none"),
					]),
					when('&[aria-selected="true"]:not([data-selection-start]):not([data-selection-end])', [
						bg("brand.tint"),
						fg("brand.emphasis"),
						roundedCorner("start-start", "none"),
						roundedCorner("start-end", "none"),
						roundedCorner("end-start", "none"),
						roundedCorner("end-end", "none"),
					]),
					mix,
				]}
			/>
		);
	};
};
