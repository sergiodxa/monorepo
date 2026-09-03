/**
 * A month-grid calendar surface composed from a navigable header and a native
 * `<table>` of day cells, styled through the platform's own semantics. Used
 * bare, it renders a native `<input type="date">` — a complete,
 * keyboard-operable date control on its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { ChevronLeftIcon, ChevronRightIcon } from "@sdxc/icons";
import { bg, fg, outline } from "@sdxc/u/color";
import { opacity, rounded } from "@sdxc/u/effects";
import { cursor } from "@sdxc/u/general";
import {
	basis,
	borderCollapse,
	borderSpacing,
	flex,
	grow,
	inlineBlock,
	items,
	justify,
	shrink,
} from "@sdxc/u/layout";
import { bs, is, mbe, p, pbe } from "@sdxc/u/size";
import { hover, when } from "@sdxc/u/state";
import { scaleX } from "@sdxc/u/transform";
import { text, textAlign, textDecoration, weight } from "@sdxc/u/typography";
import { attrs } from "remix/ui";

import { interactiveTransition } from "../styles/interactive-transition.js";
import {
	warnIfNoAccessibleLabel,
	warnIfNoAccessibleName,
} from "../utils/warn-if-no-accessible-name.js";

import { Heading } from "./heading.js";
import { Input } from "./input.js";

const DEFAULT_COLOR: Calendar.Color = "neutral";

/**
 * `type` for {@link Calendar.PreviousButton} and {@link Calendar.NextButton}
 * when a consumer supplies none, keeping a click on either control a plain
 * month change inside a surrounding `<form>`.
 */
const DEFAULT_NAV_BUTTON_TYPE: NonNullable<Calendar.PreviousButtonProps["type"]> = "button";

/**
 * Prop types for {@link Calendar} and its compound parts.
 */
export namespace Calendar {
	/**
	 * Semantic color role for the bare `<input type="date">` fallback's keyboard
	 * focus ring, each mapped to its matching `--ui-*` variables. The composed
	 * grid reads fixed semantic roles, identical across every rendered month.
	 */
	export type Color = "brand" | "neutral" | "success" | "warning" | "danger";

	/**
	 * Props accepted by {@link Calendar}. Composing {@link Calendar.Header} and
	 * {@link Calendar.Grid} as `children` renders the visual month surface;
	 * `children` left unset renders the native `<input type="date">` fallback.
	 */
	export interface Props extends TagProps<"div"> {
		/** Semantic color role for the bare fallback control's focus ring. Defaults to {@link DEFAULT_COLOR}. */
		color?: Color;
		/** Native `name` submitted with an enclosing form, read only by the bare fallback control. */
		name?: string;
		/** Current value, in `YYYY-MM-DD` form, for a bare fallback control a consumer tracks itself. */
		value?: string;
		/** Initial value, in `YYYY-MM-DD` form, for a bare fallback control left to the platform's own uncontrolled state. */
		defaultValue?: string;
		/** Earliest accepted date, in `YYYY-MM-DD` form, read only by the bare fallback control. */
		min?: string;
		/** Latest accepted date, in `YYYY-MM-DD` form, read only by the bare fallback control. */
		max?: string;
		/** Granularity, in days, the bare fallback control's value must fall on. */
		step?: number;
		/** Marks the bare fallback control required for its enclosing form. */
		required?: boolean;
		/** Marks the bare fallback control inert and excluded from the tab order. */
		disabled?: boolean;
		/** Marks the bare fallback control's value fixed, while keeping it focusable and included in form submission. */
		readOnly?: boolean;
		/** Native autofill hint for the bare fallback control, e.g. `"bday"`. */
		autoComplete?: string;
	}

	/**
	 * Every native `<header>` attribute, unchanged, plus the `mix` passthrough.
	 */
	export interface HeaderProps extends TagProps<"header"> {}

	/**
	 * Every native `<button>` attribute, unchanged, plus the `mix` passthrough.
	 * `type` defaults to {@link DEFAULT_NAV_BUTTON_TYPE}. Needs an `aria-label`
	 * (e.g. `"Previous month"`) as the control's only accessible name.
	 */
	export interface PreviousButtonProps extends TagProps<"button"> {}

	/**
	 * Every native `<button>` attribute, unchanged, plus the `mix`
	 * passthrough, mirroring {@link Calendar.PreviousButton} for the following
	 * month instead.
	 */
	export interface NextButtonProps extends TagProps<"button"> {}

	/**
	 * Every prop {@link Heading} accepts, unchanged. `level` still chooses
	 * which native heading element renders, defaulting the same way
	 * {@link Heading} does.
	 */
	export interface HeadingProps extends Heading.Props {}

	/**
	 * Every native `<table>` attribute, unchanged, plus the `mix` passthrough.
	 */
	export interface GridProps extends TagProps<"table"> {}

	/**
	 * Every native `<thead>` attribute, unchanged, plus the `mix` passthrough.
	 */
	export interface GridHeaderProps extends TagProps<"thead"> {}

	/**
	 * Every native `<tr>` attribute, unchanged, plus the `mix` passthrough. Holds
	 * one row of {@link Calendar.HeaderCell} in {@link Calendar.GridHeader}, or
	 * one week of {@link Calendar.Cell} in {@link Calendar.GridBody}.
	 */
	export interface RowProps extends TagProps<"tr"> {}

	/**
	 * Every native `<th>` attribute, unchanged, plus the `mix` passthrough.
	 */
	export interface HeaderCellProps extends TagProps<"th"> {}

	/**
	 * Every native `<tbody>` attribute, unchanged, plus the `mix` passthrough.
	 */
	export interface GridBodyProps extends TagProps<"tbody"> {}

	/**
	 * Every native `<td>` attribute, unchanged, plus the `mix` passthrough. Day
	 * state is read straight off the rendered element: the consumer sets
	 * `aria-selected`, `aria-disabled`, `data-unavailable`, `data-outside-month`.
	 */
	export interface CellProps extends TagProps<"td"> {}
}

/**
 * Renders a rounded, padded surface around whichever children a consumer
 * composes; `children` left unset renders a native `<input type="date">`
 * through {@link Input}, the one part the platform itself operates.
 *
 * @param handle Runtime handle carrying the root element's props.
 * @returns The render function producing the calendar's markup.
 * @example
 * <Calendar aria-label={t("form.startDate.label")} name="startDate" />
 * @example
 * <Calendar aria-label={t("calendar.label")}>
 * 	<Calendar.Header>
 * 		<Calendar.PreviousButton aria-label={t("calendar.previous")} />
 * 		<Calendar.Heading>{monthLabel}</Calendar.Heading>
 * 		<Calendar.NextButton aria-label={t("calendar.next")} />
 * 	</Calendar.Header>
 * 	<Calendar.Grid aria-label={monthLabel}>
 * 		<Calendar.GridHeader>
 * 			<Calendar.Row>
 * 				{weekdayLabels.map((day) => (
 * 					<Calendar.HeaderCell key={day}>{day}</Calendar.HeaderCell>
 * 				))}
 * 			</Calendar.Row>
 * 		</Calendar.GridHeader>
 * 		<Calendar.GridBody>
 * 			{weeks.map((week) => (
 * 				<Calendar.Row key={week[0].iso}>
 * 					{week.map((day) => (
 * 						<Calendar.Cell
 * 							key={day.iso}
 * 							aria-selected={day.iso === selected ? "true" : undefined}
 * 							data-outside-month={day.outsideMonth ? "" : undefined}
 * 						>
 * 							{day.label}
 * 						</Calendar.Cell>
 * 					))}
 * 				</Calendar.Row>
 * 			))}
 * 		</Calendar.GridBody>
 * 	</Calendar.Grid>
 * </Calendar>
 */
export function Calendar(handle: Handle<Calendar.Props>) {
	return () => {
		let {
			color,
			name,
			value,
			defaultValue,
			min,
			max,
			step,
			required,
			disabled,
			readOnly,
			autoComplete,
			"aria-label": ariaLabel,
			"aria-labelledby": ariaLabelledBy,
			children,
			mix,
			...rest
		} = handle.props;
		let resolvedColor = color ?? DEFAULT_COLOR;

		if (import.meta.env.DEV && !children && !ariaLabel && !ariaLabelledBy) {
			console.warn(
				'Calendar: falling back to a plain "input type=date" needs an "aria-label" or "aria-labelledby" describing what it collects for assistive technology.',
			);
		}

		return (
			<div
				{...rest}
				data-slot="calendar"
				mix={[inlineBlock(), rounded("lg"), p(3), bg("neutral.tint"), mix]}
			>
				{children ?? (
					<Input
						type="date"
						color={resolvedColor}
						name={name}
						value={value}
						defaultValue={defaultValue}
						min={min}
						max={max}
						step={step}
						required={required}
						disabled={disabled}
						readOnly={readOnly}
						autoComplete={autoComplete}
						aria-label={ariaLabel}
						aria-labelledby={ariaLabelledBy}
					/>
				)}
			</div>
		);
	};
}

/**
 * Renders {@link Calendar}'s nav row: a flex row spacing
 * {@link Calendar.PreviousButton}, {@link Calendar.Heading}, and
 * {@link Calendar.NextButton} apart, the heading centered between the controls.
 *
 * @param handle Runtime handle carrying the host `<header>`'s props.
 * @returns The render function producing the nav row's markup.
 * @example
 * <Calendar.Header>
 * 	<Calendar.PreviousButton aria-label={t("calendar.previous")} />
 * 	<Calendar.Heading>{monthLabel}</Calendar.Heading>
 * 	<Calendar.NextButton aria-label={t("calendar.next")} />
 * </Calendar.Header>
 */
Calendar.Header = function CalendarHeader(handle: Handle<Calendar.HeaderProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<header
				{...rest}
				data-slot="header"
				mix={[flex(), items("center"), justify("between"), mbe(4), mix]}
			/>
		);
	};
};

/**
 * Renders a round icon control standing for "show the previous month", sized
 * to match {@link Calendar.NextButton}. Its default chevron flips under
 * `dir="rtl"` through CSS. A `calendarKeys()` mixin drives the behavior.
 *
 * @param handle Runtime handle carrying the host `<button>`'s props.
 * @returns The render function producing the control's markup.
 * @example
 * <Calendar.PreviousButton aria-label={t("calendar.previous")} />
 */
Calendar.PreviousButton = function CalendarPreviousButton(
	handle: Handle<Calendar.PreviousButtonProps>,
) {
	return () => {
		let { type, children, mix, ...rest } = handle.props;

		warnIfNoAccessibleName(
			handle.props,
			children,
			'Calendar.PreviousButton: an icon-only control needs an "aria-label" describing what it does — assistive technology has no accessible text to announce otherwise.',
		);

		return (
			<button
				type={type ?? DEFAULT_NAV_BUTTON_TYPE}
				{...rest}
				data-slot="previous-button"
				mix={[
					interactiveTransition(),
					when("&:focus-visible", outline({ color: "brand.ring", offset: 2 })),
					flex(),
					items("center"),
					justify("center"),
					is(8),
					bs(8),
					rounded("full"),
					fg("neutral"),
					hover(bg("neutral.bg-tint-hover")),
					when("&:disabled", [cursor("not-allowed"), opacity(50)]),
					when("& svg", [is(4), bs(4)]),
					when("&:dir(rtl) svg", scaleX(-1)),
					mix,
				]}
			>
				{children ?? <ChevronLeftIcon />}
			</button>
		);
	};
};

/**
 * Renders a round icon control standing for "show the following month", with
 * the rendering, focus, and disabled-state contract of
 * {@link Calendar.PreviousButton} and a trailing chevron by default.
 *
 * @param handle Runtime handle carrying the host `<button>`'s props.
 * @returns The render function producing the control's markup.
 * @example
 * <Calendar.NextButton aria-label={t("calendar.next")} />
 */
Calendar.NextButton = function CalendarNextButton(handle: Handle<Calendar.NextButtonProps>) {
	return () => {
		let { type, children, mix, ...rest } = handle.props;

		warnIfNoAccessibleName(
			handle.props,
			children,
			'Calendar.NextButton: an icon-only control needs an "aria-label" describing what it does — assistive technology has no accessible text to announce otherwise.',
		);

		return (
			<button
				type={type ?? DEFAULT_NAV_BUTTON_TYPE}
				{...rest}
				data-slot="next-button"
				mix={[
					interactiveTransition(),
					when("&:focus-visible", outline({ color: "brand.ring", offset: 2 })),
					flex(),
					items("center"),
					justify("center"),
					is(8),
					bs(8),
					rounded("full"),
					fg("neutral"),
					hover(bg("neutral.bg-tint-hover")),
					when("&:disabled", [cursor("not-allowed"), opacity(50)]),
					when("& svg", [is(4), bs(4)]),
					when("&:dir(rtl) svg", scaleX(-1)),
					mix,
				]}
			>
				{children ?? <ChevronRightIcon />}
			</button>
		);
	};
};

/**
 * Renders the consumer-formatted month/year caption through {@link Heading},
 * centered between the nav controls at a small semibold size layered after
 * {@link Heading}'s own defaults, so this size and alignment win over them.
 *
 * @param handle Runtime handle carrying the host heading element's props.
 * @returns The render function producing the caption's markup.
 * @example
 * <Calendar.Heading>{new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(visibleMonth)}</Calendar.Heading>
 */
Calendar.Heading = function CalendarHeading(handle: Handle<Calendar.HeadingProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<Heading
				{...rest}
				data-slot="heading"
				mix={[
					grow(),
					shrink(1),
					basis("0%"),
					textAlign("center"),
					weight("semibold"),
					fg("neutral.emphasis"),
					text("sm"),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders the day grid's native `<table>` host, rows and cells set apart by a
 * small gap on every side. Its `aria-label`/`aria-labelledby` — typically the
 * visible month label — names the whole grid; dev mode warns when it is absent.
 *
 * @param handle Runtime handle carrying the host `<table>`'s props.
 * @returns The render function producing the grid's markup.
 * @example
 * <Calendar.Grid aria-label={monthLabel}>
 * 	<Calendar.GridHeader>...</Calendar.GridHeader>
 * 	<Calendar.GridBody>...</Calendar.GridBody>
 * </Calendar.Grid>
 */
Calendar.Grid = function CalendarGrid(handle: Handle<Calendar.GridProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		warnIfNoAccessibleLabel(
			handle.props,
			'Calendar.Grid: needs an "aria-label" or "aria-labelledby" identifying which month it shows for assistive technology.',
		);

		return (
			<table
				{...rest}
				data-slot="grid"
				mix={[borderCollapse("separate"), borderSpacing("0.25rem"), mix]}
			/>
		);
	};
};

/**
 * Renders the grid's `<thead>` host: a plain wrapper for the weekday
 * {@link Calendar.Row}.
 *
 * @param handle Runtime handle carrying the host `<thead>`'s props.
 * @returns The render function producing the header section's markup.
 * @example
 * <Calendar.GridHeader>
 * 	<Calendar.Row>
 * 		<Calendar.HeaderCell>{t("calendar.weekdays.sun")}</Calendar.HeaderCell>
 * 	</Calendar.Row>
 * </Calendar.GridHeader>
 */
Calendar.GridHeader = function CalendarGridHeader(handle: Handle<Calendar.GridHeaderProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return <thead {...rest} data-slot="grid-header" mix={[mix]} />;
	};
};

/**
 * Renders a native `<tr>` host: one row of {@link Calendar.HeaderCell} inside
 * {@link Calendar.GridHeader}, or one week of {@link Calendar.Cell} inside
 * {@link Calendar.GridBody}.
 *
 * @param handle Runtime handle carrying the host `<tr>`'s props.
 * @returns The render function producing the row's markup.
 * @example
 * <Calendar.Row>
 * 	<Calendar.Cell>{day.label}</Calendar.Cell>
 * </Calendar.Row>
 */
Calendar.Row = function CalendarRow(handle: Handle<Calendar.RowProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return <tr {...rest} data-slot="row" mix={[mix]} />;
	};
};

/**
 * Renders a weekday abbreviation inside a native `<th scope="col">`, sized
 * small and muted beneath {@link Calendar.Cell}'s own larger day numbers.
 *
 * @param handle Runtime handle carrying the host `<th>`'s props.
 * @returns The render function producing the weekday header's markup.
 * @example
 * <Calendar.HeaderCell>{t("calendar.weekdays.sun")}</Calendar.HeaderCell>
 */
Calendar.HeaderCell = function CalendarHeaderCell(handle: Handle<Calendar.HeaderCellProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<th
				{...rest}
				data-slot="header-cell"
				mix={[
					attrs({ scope: "col" }),
					pbe(2),
					weight("medium"),
					fg("neutral.muted"),
					text("xs"),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders the grid's `<tbody>` host: a plain wrapper for one
 * {@link Calendar.Row} per week.
 *
 * @param handle Runtime handle carrying the host `<tbody>`'s props.
 * @returns The render function producing the body section's markup.
 * @example
 * <Calendar.GridBody>
 * 	{weeks.map((week) => (
 * 		<Calendar.Row key={week[0].iso}>...</Calendar.Row>
 * 	))}
 * </Calendar.GridBody>
 */
Calendar.GridBody = function CalendarGridBody(handle: Handle<Calendar.GridBodyProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return <tbody {...rest} data-slot="grid-body" mix={[mix]} />;
	};
};

/**
 * Renders one calendar day inside a native `<td>`, a fixed round pill around
 * its number. `aria-selected`, `aria-disabled`, `data-unavailable`,
 * `data-outside-month`, and `aria-invalid` each drive their own visual state.
 *
 * @param handle Runtime handle carrying the host `<td>`'s props.
 * @returns The render function producing the day's markup.
 * @example
 * <Calendar.Cell aria-selected={day.iso === selected ? "true" : undefined}>
 * 	{day.label}
 * </Calendar.Cell>
 * @example
 * <Calendar.Cell data-outside-month="">{day.label}</Calendar.Cell>
 */
Calendar.Cell = function CalendarCell(handle: Handle<Calendar.CellProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<td
				{...rest}
				data-slot="cell"
				mix={[
					interactiveTransition(),
					when("&:focus-visible", outline({ color: "brand.ring", offset: 2 })),
					flex(),
					items("center"),
					justify("center"),
					is(9),
					bs(9),
					cursor("default"),
					rounded("full"),
					fg("neutral.emphasis"),
					text("sm"),
					hover(bg("neutral.bg-tint-hover")),
					when('&[aria-selected="true"]', [bg("brand.solid"), fg("brand.onSolid")]),
					when('&[aria-disabled="true"]', [cursor("not-allowed"), opacity(30)]),
					when("&[data-unavailable]", [fg("neutral.muted"), textDecoration("line-through")]),
					when("&[data-outside-month]", fg("neutral.muted")),
					when('&[aria-invalid="true"]', [bg("danger.solid"), fg("danger.onSolid")]),
					mix,
				]}
			/>
		);
	};
};
