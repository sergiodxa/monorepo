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
import { gap } from "@pkg/u/layout";
import { when } from "@pkg/u/state";
import { attrs, css } from "remix/ui";

import { Calendar } from "./calendar";
import { Input } from "./input";

/** Semantic color role {@link RangeCalendar}'s bare fallback pair falls back to when `color` is omitted. */
const DEFAULT_COLOR: RangeCalendar.Color = "neutral";

/**
 * Prop types for {@link RangeCalendar} and its compound parts. Every part but
 * {@link RangeCalendar.Cell} is an alias of {@link Calendar}'s matching part,
 * since {@link RangeCalendar} shares {@link Calendar}'s header, grid, and row
 * markup rather than declaring an independent shape of its own;
 * {@link RangeCalendar.Cell} builds on {@link Calendar.CellProps}, adding no
 * new fields of its own — only new attributes a consumer sets directly on
 * the rendered element.
 */
export namespace RangeCalendar {
	/**
	 * Semantic color role for the bare fallback pair's keyboard focus rings,
	 * each mapped to its matching `--ui-*` variables, mirroring
	 * {@link Calendar.Color}. The composed grid's day cells read fixed
	 * semantic roles instead, matching every rendered month regardless of
	 * this value.
	 */
	export type Color = Calendar.Color;

	/**
	 * Per-part styling for the bare fallback pair's two internally composed
	 * inputs, layered after each input's own built-in styling. Style the
	 * composed grid's parts individually instead through {@link Calendar}'s
	 * own compound parts, aliased on {@link RangeCalendar}.
	 */
	export interface PartsProps {
		/** Styling for the bare fallback's start-date input, rendered through {@link Input}. */
		start?: TagProps<"input">["mix"];
		/** Styling for the bare fallback's end-date input, rendered through {@link Input}. */
		end?: TagProps<"input">["mix"];
	}

	/**
	 * Props accepted by {@link RangeCalendar}. Composing {@link RangeCalendar.Header}
	 * and {@link RangeCalendar.Grid} (or either alone) as `children` renders the
	 * visual month surface, its day cells carrying range position through
	 * {@link RangeCalendar.Cell}; leaving `children` unset renders a bare pair
	 * of native `<input type="date">` fields instead, using the fields below.
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
	 * `data-selection-start` on the day beginning the range,
	 * `data-selection-end` on the day ending it, and `aria-selected="true"`
	 * alone — neither start nor end — on every day between them, alongside
	 * every state {@link Calendar.CellProps} already documents. None of these
	 * are computed by this module itself; every one is read straight off
	 * whatever the rendering consumer sets on this instance.
	 */
	export interface CellProps extends Calendar.CellProps {}
}

/**
 * Renders {@link RangeCalendar}'s root by rendering straight through to
 * {@link Calendar}, so the surrounding box — its rounded corners, padding,
 * and tinted background — stays byte-for-byte identical to a plain
 * {@link Calendar}. Composing {@link RangeCalendar.Header} and
 * {@link RangeCalendar.Grid} (aliases of {@link Calendar}'s own parts) as
 * `children` renders the visual month surface, its day cells carrying range
 * position through {@link RangeCalendar.Cell}; leaving `children` unset
 * renders a bare pair of native `<input type="date">` fields instead — start
 * and end, grouped under a native `role="group"` — driven by this instance's
 * own `color`, `startName`/`endName`, `startValue`/`endValue`,
 * `startDefaultValue`/`endDefaultValue`, `min`/`max`, `step`, `required`,
 * `disabled`, `readOnly`, and `autoComplete`. A field whose value must keep
 * working with no script attached reads that value from this bare fallback
 * pair, since that's the one part of this module the platform itself
 * operates.
 *
 * In dev mode, the bare fallback pair — rendered whenever `children` is
 * unset — logs a `console.warn` for either input missing a `startLabel` or
 * `endLabel`, since neither native date picker otherwise has an accessible
 * name to announce.
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
						mix={[
							attrs({ role: "group" }),
							css({
								display: "flex",
								alignItems: "center",
							}),
							gap("0.5rem"),
						]}
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
 * to {@link Calendar.Header}, since {@link RangeCalendar} shares its grid
 * markup with {@link Calendar} rather than declaring its own header.
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
 * one row of {@link RangeCalendar.HeaderCell} inside
 * {@link RangeCalendar.GridHeader}, or one week's row of
 * {@link RangeCalendar.Cell} inside {@link RangeCalendar.GridBody}.
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
 * {@link Calendar.Cell} for its pill shape and single-day states — hover,
 * `aria-selected`, `aria-disabled`, `data-unavailable`, `data-outside-month`,
 * focus-visible, and `aria-invalid` all carry over unchanged. On top of
 * that, `data-selection-start` squares off the cell's trailing corners so it
 * merges into the range running after it, `data-selection-end` squares off
 * its leading corners to merge into the range running before it, and a day
 * carrying `aria-selected="true"` alone — neither the start nor the end —
 * squares off every corner and fills with the primary tint rather than the
 * solid endpoint color, reading as one unbroken bar between the two dates it
 * connects.
 *
 * None of these states are computed by this module itself: every one is read
 * straight off whatever the rendering consumer sets on this instance, ready
 * for the `calendarKeys()`/`rangePreview()` mixins a consumer attaches to
 * turn a pointer drag or arrow-key extension into a live pending range.
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
					css({
						"&[data-selection-start]": {
							borderStartEndRadius: "0",
							borderEndEndRadius: "0",
						},
						"&[data-selection-end]": {
							borderStartStartRadius: "0",
							borderEndStartRadius: "0",
						},
						'&[aria-selected="true"]:not([data-selection-start]):not([data-selection-end])': {
							borderStartStartRadius: "0",
							borderStartEndRadius: "0",
							borderEndStartRadius: "0",
							borderEndEndRadius: "0",
						},
					}),
					when("&[data-selection-start]", [bg("primary.solid"), fg("primary.onSolid")]),
					when("&[data-selection-end]", [bg("primary.solid"), fg("primary.onSolid")]),
					when('&[aria-selected="true"]:not([data-selection-start]):not([data-selection-end])', [
						bg("primary.tint"),
						fg("primary.emphasis"),
					]),
					mix,
				]}
			/>
		);
	};
};
