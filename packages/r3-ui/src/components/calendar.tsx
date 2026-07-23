/**
 * A month-grid calendar surface, composed from a navigable header and a
 * native `<table>` of day cells, styled entirely through the platform's own
 * semantics. Used bare, with no composed children, it renders a native
 * `<input type="date">` instead — a complete, keyboard-operable date control
 * on its own, and the foundation later waves build RangeCalendar and
 * DatePicker's richer, mixin-driven interaction on top of.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { ChevronLeftIcon, ChevronRightIcon } from "@pkg/lucide-remix";
import { bg, fg } from "@pkg/u/color";
import { opacity, rounded } from "@pkg/u/effects";
import { cursor, raw } from "@pkg/u/general";
import { flex, inlineBlock, items, justify } from "@pkg/u/layout";
import { bs, is, mbe, p, pbe } from "@pkg/u/size";
import { hover, when } from "@pkg/u/state";
import { textAlign, weight } from "@pkg/u/typography";
import { attrs } from "remix/ui";

import { focusRingPrimary } from "../styles/focus-ring";
import { interactiveTransition } from "../styles/interactive-transition";
import {
	warnIfNoAccessibleLabel,
	warnIfNoAccessibleName,
} from "../utils/warn-if-no-accessible-name";

import { Heading } from "./heading";
import { Input } from "./input";

/** Semantic color role {@link Calendar}'s bare `<input type="date">` fallback falls back to when `color` is omitted. */
const DEFAULT_COLOR: Calendar.Color = "neutral";

/**
 * `type` {@link Calendar.PreviousButton} and {@link Calendar.NextButton} fall
 * back to when a consumer doesn't supply one, keeping a click on either
 * control from submitting a surrounding `<form>` the way a bare `<button>`'s
 * default type otherwise would.
 */
const DEFAULT_NAV_BUTTON_TYPE: NonNullable<Calendar.PreviousButtonProps["type"]> = "button";

/**
 * Prop types for {@link Calendar} and its compound parts.
 */
export namespace Calendar {
	/**
	 * Semantic color role for the bare `<input type="date">` fallback's
	 * keyboard focus ring, each mapped to its matching `--ui-*` variables. The
	 * composed grid's own colors — hover, selection, and the rest — read fixed
	 * semantic roles instead, matching every rendered month regardless of this
	 * value.
	 */
	export type Color = "primary" | "neutral" | "success" | "warning" | "danger";

	/**
	 * Props accepted by {@link Calendar}. Composing {@link Calendar.Header} and
	 * {@link Calendar.Grid} (or either alone) as `children` renders the visual
	 * month surface; leaving `children` unset renders the native
	 * `<input type="date">` fallback instead, using the fields below.
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
	 * Every native `<button>` attribute, unchanged, plus the `mix`
	 * passthrough. `type` defaults to {@link DEFAULT_NAV_BUTTON_TYPE}. Left
	 * without `children`, the control renders its own leading chevron glyph;
	 * it needs an `aria-label` (e.g. `"Previous month"`) either way, since a
	 * bare directional glyph gives assistive technology no accessible name.
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
	 * Every native `<tr>` attribute, unchanged, plus the `mix` passthrough.
	 * Composes one row of {@link Calendar.HeaderCell} inside
	 * {@link Calendar.GridHeader}, or one row of {@link Calendar.Cell} — a
	 * week — inside {@link Calendar.GridBody}.
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
	 * Every native `<td>` attribute, unchanged, plus the `mix` passthrough.
	 * Set `aria-selected="true"` directly on a chosen day, `aria-disabled="true"`
	 * on one outside `min`/`max`, `data-unavailable` on one a consumer's own
	 * rule excludes, and `data-outside-month` on one belonging to the month
	 * before or after the one shown — all read straight off the rendered
	 * element, with no date arithmetic carried out by this module itself.
	 */
	export interface CellProps extends TagProps<"td"> {}
}

/**
 * Renders {@link Calendar}'s root: a rounded, padded surface holding whichever
 * children a consumer composes. Composing {@link Calendar.Header} and
 * {@link Calendar.Grid} renders the visual month surface described by every
 * other compound part below; leaving `children` unset renders a native
 * `<input type="date">` instead, styled through {@link Input} and driven by
 * this instance's own `color`, `name`, `value`/`defaultValue`, `min`/`max`,
 * `step`, `required`, `disabled`, `readOnly`, and `autoComplete` — a complete,
 * keyboard-operable date control with no composed grid at all.
 *
 * The composed grid renders every day's state exactly as a consumer sets
 * it — `aria-selected`, `aria-disabled`, `data-unavailable`,
 * `data-outside-month` — with no click or key handling of its own, ready for
 * a `calendarKeys()` mixin a consumer attaches later to turn its cells and
 * {@link Calendar.PreviousButton}/{@link Calendar.NextButton} into an
 * in-place, arrow-key-driven picker. A field whose value must keep working
 * with no script attached reads that value from the bare fallback control
 * above instead, since that's the one part of this module the platform
 * itself operates.
 *
 * In dev mode, the bare fallback control — rendered whenever `children` is
 * unset — logs a `console.warn` if neither `aria-label` nor
 * `aria-labelledby` is present, since the platform's own date-picker
 * affordance otherwise has no accessible name to announce.
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
 * {@link Calendar.NextButton} apart, with the heading centered between the
 * two controls.
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
 * Renders a round icon control sized to match {@link Calendar.NextButton},
 * standing for "show the previous month." Hover and disabled states ride the
 * native `:hover` and `:disabled` pseudo-classes, and a keyboard
 * focus-visible ring reads in the primary color. Left without `children`, it
 * renders a leading chevron that a `dir="rtl"` ancestor mirrors automatically
 * through CSS, with no locale lookup of its own — the same glyph, flipped,
 * rather than a second icon swapped in by script.
 *
 * The control carries no click behavior of its own: it renders the markup
 * and states a `calendarKeys()` mixin drives once a consumer attaches it in
 * their own hydrated island.
 *
 * In dev mode, a control whose content carries no plain text and no
 * `aria-label`/`aria-labelledby` logs a `console.warn`, since a directional
 * icon alone gives assistive technology no accessible name to announce.
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
					focusRingPrimary(),
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
					raw({ "&:dir(rtl) svg": { transform: "scaleX(-1)" } }),
					mix,
				]}
			>
				{children ?? <ChevronLeftIcon aria-hidden />}
			</button>
		);
	};
};

/**
 * Renders a round icon control sized to match
 * {@link Calendar.PreviousButton}, standing for "show the following month"
 * instead — see {@link Calendar.PreviousButton} for the shared rendering,
 * focus, and disabled-state contract. Left without `children`, it renders a
 * trailing chevron, mirrored the same way under `dir="rtl"`.
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
					focusRingPrimary(),
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
					raw({ "&:dir(rtl) svg": { transform: "scaleX(-1)" } }),
					mix,
				]}
			>
				{children ?? <ChevronRightIcon aria-hidden />}
			</button>
		);
	};
};

/**
 * Renders the calendar's visible month/year caption through {@link Heading},
 * centered in the space between {@link Calendar.PreviousButton} and
 * {@link Calendar.NextButton} and set at a small, semibold emphasis size —
 * layered after {@link Heading}'s own default styling, so this size and
 * alignment always win over it. `level` still chooses the underlying native
 * heading element, defaulting the same way {@link Heading} does, so the
 * caption keeps a correct depth in the surrounding document outline.
 *
 * The caption's text is a consumer-formatted string — built from the
 * platform's own `Intl.DateTimeFormat` against whichever locale applies —
 * rather than anything this module formats itself.
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
					raw({ flex: "1 1 0%" }),
					textAlign("center"),
					weight("semibold"),
					fg("neutral.emphasis"),
					raw({ fontSize: "0.875rem", lineHeight: "calc(1.25 / 0.875)" }),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders the day grid's native `<table>` host, its rows and cells set apart
 * by a small gap on every side instead of touching borders. Holds
 * {@link Calendar.GridHeader} and {@link Calendar.GridBody}.
 *
 * In dev mode, a grid rendered without an `aria-label` or `aria-labelledby`
 * logs a `console.warn`, since assistive technology otherwise has no
 * accessible name for the grid as a whole — typically the same visible month
 * label {@link Calendar.Heading} already renders.
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
				mix={[raw({ borderCollapse: "separate", borderSpacing: "0.25rem" }), mix]}
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
 * Renders a native `<tr>` host with no styling of its own beyond what a table
 * row needs structurally — composes one row of {@link Calendar.HeaderCell}
 * inside {@link Calendar.GridHeader}, or one week's row of
 * {@link Calendar.Cell} inside {@link Calendar.GridBody}.
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
					raw({ fontSize: "0.75rem", lineHeight: "calc(1 / 0.75)" }),
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
 * Renders one calendar day inside a native `<td>`, sized as a fixed round
 * pill and centering its number. A selected day (`aria-selected="true"`)
 * fills with the primary solid background; a disabled one
 * (`aria-disabled="true"`, e.g. outside `min`/`max`) dims and blocks the
 * pointer; an unavailable one (`data-unavailable` — a consumer's own
 * exclusion rule, a fully booked date, say) strikes through and mutes; a day
 * belonging to the month before or after the one shown (`data-outside-month`)
 * mutes without striking through; an invalid one (`aria-invalid="true"`, set
 * alongside a validation message elsewhere in the field) fills with the
 * danger solid background. None of these states are computed by this module
 * itself — every one is read straight off whatever the rendering consumer
 * sets on this instance.
 *
 * The cell carries no click or focus behavior of its own: it renders the
 * markup and states a `calendarKeys()` mixin drives once a consumer attaches
 * it in their own hydrated island.
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
					focusRingPrimary(),
					flex(),
					items("center"),
					justify("center"),
					is(9),
					bs(9),
					cursor("default"),
					rounded("full"),
					fg("neutral.emphasis"),
					raw({ fontSize: "0.875rem", lineHeight: "calc(1.25 / 0.875)" }),
					hover(bg("neutral.bg-tint-hover")),
					when('&[aria-selected="true"]', [bg("primary.solid"), fg("primary.onSolid")]),
					when('&[aria-disabled="true"]', [cursor("not-allowed"), opacity(30)]),
					when("&[data-unavailable]", [
						fg("neutral.muted"),
						raw({ textDecoration: "line-through" }),
					]),
					when("&[data-outside-month]", fg("neutral.muted")),
					when('&[aria-invalid="true"]', [bg("danger.solid"), fg("danger.onSolid")]),
					mix,
				]}
			/>
		);
	};
};
