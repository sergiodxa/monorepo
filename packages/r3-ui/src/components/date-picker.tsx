/**
 * A labeled date field building on {@link DateField} for its plain fallback,
 * extended with a {@link DatePicker.Group} row and a trigger
 * {@link DatePicker.Button} for composing a {@link DatePicker.Dialog} —
 * a Popover-hosted calendar surface — alongside it. Composing
 * {@link DatePicker.Group} and {@link DatePicker.Dialog} as children swaps in
 * that richer trigger-and-calendar layout in place of the plain fallback
 * field; leaving `children` unset keeps the fallback on its own, a complete,
 * keyboard-operable control with no composed surface at all.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import { CalendarIcon } from "@pkg/lucide-remix";
import { bg, fg, outline } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { flex, flexCol, gap, items, justify } from "@pkg/u/layout";
import { bs, is, mis, p } from "@pkg/u/size";
import { hover, when } from "@pkg/u/state";
import { attrs } from "remix/ui";

import { interactiveTransition } from "../styles/interactive-transition";
import { warnIfNoAccessibleLabel } from "../utils/warn-if-no-accessible-name";

import { DateField } from "./date-field";
import { Popover } from "./popover";

/**
 * Native `<button>` `type` {@link DatePicker.Button} falls back to when a
 * consumer doesn't supply one, keeping a click on the trigger from
 * submitting a surrounding `<form>` the way a bare `<button>`'s default type
 * otherwise would.
 */
const DEFAULT_BUTTON_TYPE: NonNullable<DatePicker.ButtonProps["type"]> = "button";

/**
 * `role` applied to {@link DatePicker.Dialog}'s host through {@link attrs}
 * unless a consumer supplies its own, identifying the surface as a non-modal
 * dialog layered above the page rather than a full-screen modal.
 */
const DEFAULT_DIALOG_ROLE = "dialog";

/**
 * Side of the trigger {@link DatePicker.Dialog} renders against when
 * `placement` is left unset, reading down and start-ward the way a dropdown
 * conventionally does.
 */
const DEFAULT_DIALOG_PLACEMENT: Popover.Placement = "bottom-start";

/**
 * Prop types for {@link DatePicker} and its compound parts.
 */
export namespace DatePicker {
	/**
	 * Semantic color role for the fallback field's keyboard focus ring,
	 * mirroring {@link DateField.Color}. Read only by the fallback field —
	 * {@link DatePicker.Group}'s composed control carries no `color` prop of
	 * its own, since it's rendered directly by the consumer.
	 */
	export type Color = DateField.Color;

	/**
	 * Every prop {@link DateField.PartsProps} accepts, unchanged. Applies only
	 * to the fallback field's internally composed label, control, description,
	 * and error — the composed layout styles its own parts individually
	 * through {@link DatePicker.Group}, {@link DatePicker.Button}, and
	 * {@link DatePicker.Dialog} instead.
	 */
	export interface PartsProps extends DateField.PartsProps {}

	/**
	 * Props accepted by {@link DatePicker}. Leaving `children` unset renders
	 * {@link DateField}'s own plain fallback field, using every field below;
	 * composing {@link DatePicker.Group} and {@link DatePicker.Dialog} as
	 * `children` instead renders the richer trigger-and-calendar layout, and
	 * every field below goes unread — build the fallback's caption,
	 * supporting copy, and validation message directly into that composed
	 * layout instead.
	 */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		/** Semantic color role for the fallback field's focus ring. Read only when `children` is unset. */
		color?: Color;
		/** The fallback field's caption, rendered through {@link DateField}. Read only when `children` is unset. */
		label?: RemixNode;
		/** Supporting copy beneath the fallback field. Read only when `children` is unset. */
		description?: RemixNode;
		/** Validation message beneath the fallback field. Read only when `children` is unset. */
		errorMessage?: RemixNode;
		/** Native `name` submitted with an enclosing form, read only by the fallback field. */
		name?: string;
		/** Current value, in `YYYY-MM-DD` form, for a fallback field a consumer tracks itself. */
		value?: string;
		/** Initial value, in `YYYY-MM-DD` form, for a fallback field left to the platform's own uncontrolled state. */
		defaultValue?: string;
		/** Earliest accepted date, in `YYYY-MM-DD` form, read only by the fallback field. */
		min?: string;
		/** Latest accepted date, in `YYYY-MM-DD` form, read only by the fallback field. */
		max?: string;
		/** Granularity, in days, the fallback field's value must fall on. */
		step?: number;
		/** Marks the fallback field required for its enclosing form. */
		required?: boolean;
		/** Marks the fallback field inert and excluded from the tab order. */
		disabled?: boolean;
		/** Marks the fallback field's value fixed, while keeping it focusable and included in form submission. */
		readOnly?: boolean;
		/** Native autofill hint for the fallback field, e.g. `"bday"`. */
		autoComplete?: string;
		/** Per-part styling for the fallback field's internally composed parts. Read only when `children` is unset. */
		parts?: PartsProps;
		/**
		 * The trigger-and-calendar layout — typically a `Label`,
		 * {@link DatePicker.Group} (housing the field's own control and
		 * {@link DatePicker.Button}), and {@link DatePicker.Dialog} (housing a
		 * calendar) — rendered in place of {@link DateField}'s plain fallback.
		 * Leaving this unset renders that fallback instead, every field above
		 * passed straight through to it unchanged.
		 */
		children?: RemixNode;
	}

	/**
	 * Every native `<div>` attribute, unchanged, plus the `mix` passthrough.
	 * `children` composes the field's own control — an `Input`, styled the
	 * same way {@link DateField}'s own control is — and
	 * {@link DatePicker.Button} into one visual row.
	 */
	export interface GroupProps extends TagProps<"div"> {}

	/**
	 * Every native `<button>` attribute except `children`, which stays fixed
	 * to this button's own calendar glyph, plus the `mix` passthrough. `type`
	 * defaults to {@link DEFAULT_BUTTON_TYPE}. Point `commandfor` at
	 * {@link DatePicker.Dialog}'s `id` with `command="toggle-popover"` to wire
	 * this control up as the surface's invoker.
	 */
	export interface ButtonProps extends Omit<TagProps<"button">, "children"> {}

	/**
	 * Every prop {@link Popover.Props} accepts, since {@link DatePicker.Dialog}
	 * renders one directly as its host. `placement` defaults to
	 * {@link DEFAULT_DIALOG_PLACEMENT} rather than {@link Popover}'s own
	 * default.
	 */
	export interface DialogProps extends Popover.Props {}
}

/**
 * Renders {@link DatePicker}'s root. Leaving `children` unset renders
 * {@link DateField}'s own plain fallback field — a complete, labeled,
 * keyboard-operable `<input type="date">` — passing `color`, `label`,
 * `description`, `errorMessage`, `name`, `value`/`defaultValue`, `min`/`max`,
 * `step`, `required`, `disabled`, `readOnly`, `autoComplete`, and `parts`
 * straight through to it unchanged. Composing {@link DatePicker.Group} and
 * {@link DatePicker.Dialog} as `children` instead — typically alongside a
 * `Label` and the field's own supporting copy or validation message, built
 * directly into that composition — renders the richer trigger-and-calendar
 * layout in a single column with a small gap between its parts, and every
 * field above goes unread.
 *
 * In dev mode, falling back to {@link DateField}'s plain field with no
 * `label` set logs a `console.warn`, mirroring {@link DateField}'s own
 * accessible-name requirement.
 *
 * @param handle Runtime handle carrying the root element's props.
 * @returns The render function producing the date picker's markup.
 * @example
 * <DatePicker label={t("form.birthday.label")} name="birthday" autoComplete="bday" />
 * @example
 * <DatePicker>
 * 	<Label htmlFor="startDate">{t("form.startDate.label")}</Label>
 * 	<DatePicker.Group>
 * 		<Input id="startDate" type="date" name="startDate" />
 * 		<DatePicker.Button
 * 			commandfor="startDate-calendar"
 * 			command="toggle-popover"
 * 			aria-label={t("form.startDate.toggle")}
 * 		/>
 * 	</DatePicker.Group>
 * 	<DatePicker.Dialog id="startDate-calendar">
 * 		<Calendar aria-label={monthLabel}>
 * 			<Calendar.Header>
 * 				<Calendar.PreviousButton aria-label={t("calendar.previous")} />
 * 				<Calendar.Heading>{monthLabel}</Calendar.Heading>
 * 				<Calendar.NextButton aria-label={t("calendar.next")} />
 * 			</Calendar.Header>
 * 			<Calendar.Grid aria-label={monthLabel}>...</Calendar.Grid>
 * 		</Calendar>
 * 	</DatePicker.Dialog>
 * </DatePicker>
 */
export function DatePicker(handle: Handle<DatePicker.Props>) {
	return () => {
		let {
			color,
			label,
			description,
			errorMessage,
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
			parts,
			children,
			mix,
			...rest
		} = handle.props;

		if (import.meta.env.DEV && !children && !label) {
			console.warn(
				'DatePicker: falling back to DateField\'s plain "input type=date" needs a "label" describing what it collects for assistive technology.',
			);
		}

		if (!children) {
			return (
				<DateField
					{...rest}
					color={color}
					label={label}
					description={description}
					errorMessage={errorMessage}
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
					parts={parts}
					mix={mix}
				/>
			);
		}

		return (
			<div {...rest} data-slot="date-picker" mix={[flex(), flexCol(), gap(1), mix]}>
				{children}
			</div>
		);
	};
}

/**
 * Renders {@link DatePicker}'s control row: a plain flex host laying the
 * field's own control and {@link DatePicker.Button} out side by side. The
 * whole row gains a keyboard focus ring the moment focus lands anywhere
 * inside it — on the control itself, since the trigger button sits outside
 * the tab stop a plain `:focus` would catch — rather than waiting for the
 * button specifically.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the row's markup.
 * @example
 * <DatePicker.Group>
 * 	<Input id="startDate" type="date" name="startDate" />
 * 	<DatePicker.Button commandfor="startDate-calendar" command="toggle-popover" aria-label={t("form.startDate.toggle")} />
 * </DatePicker.Group>
 */
DatePicker.Group = function DatePickerGroup(handle: Handle<DatePicker.GroupProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="group"
				mix={[
					flex(),
					items("center"),
					when("&:focus-within", outline({ color: "primary.ring", offset: 2 })),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders {@link DatePicker}'s trailing trigger: a native `<button>` pulled
 * back over the row's reserved trailing space so it reads as part of the
 * same field, its content fixed to a calendar glyph marked `aria-hidden`
 * since the control carries no visible text of its own. Hover reads this
 * host's own native `:hover` pseudo-class, and a keyboard focus-visible ring
 * reads in the semantic primary tone. This control carries no click behavior
 * of its own — point `commandfor` at {@link DatePicker.Dialog}'s `id` with
 * `command="toggle-popover"` to wire it up as that surface's invoker, which
 * both opens the surface and becomes its implicit CSS anchor with no script
 * of this module's own.
 *
 * In dev mode, a button with no `aria-label` or `aria-labelledby` logs a
 * `console.warn`, since assistive technology otherwise has no accessible
 * name to announce for it.
 *
 * @param handle Runtime handle carrying the host `<button>`'s props.
 * @returns The render function producing the trigger's markup.
 * @example
 * <DatePicker.Button commandfor="startDate-calendar" command="toggle-popover" aria-label={t("form.startDate.toggle")} />
 */
DatePicker.Button = function DatePickerButton(handle: Handle<DatePicker.ButtonProps>) {
	return () => {
		let { type, mix, ...rest } = handle.props;

		warnIfNoAccessibleLabel(
			handle.props,
			"DatePicker.Button: this button needs an `aria-label` describing what it does — its content is a decorative glyph with no accessible name of its own.",
		);

		return (
			<button
				type={type ?? DEFAULT_BUTTON_TYPE}
				{...rest}
				data-slot="button"
				mix={[
					interactiveTransition(),
					flex(),
					items("center"),
					justify("center"),
					mis("-2.25rem"),
					is("2rem"),
					bs("2rem"),
					rounded("sm"),
					fg("neutral"),
					when("& svg", [is("1rem"), bs("1rem")]),
					hover(bg("neutral.bg-tint-hover")),
					when("&:focus-visible", outline({ color: "primary.ring", offset: 0 })),
					mix,
				]}
			>
				<CalendarIcon aria-hidden />
			</button>
		);
	};
};

/**
 * Renders {@link DatePicker}'s calendar surface: a {@link Popover} whose
 * `placement` defaults to reading down and start-ward from its invoker,
 * padded around whatever calendar a consumer composes as `children`. `role`
 * defaults to `"dialog"`.
 *
 * Opening and closing ride the Popover API exactly as {@link Popover}
 * documents — {@link DatePicker.Button}'s `commandfor`/`command="toggle-popover"`
 * both shows this surface and, by that same invoker relationship, becomes its
 * implicit CSS anchor, with no positioning logic running in script. The
 * composed calendar's day cells carry no click or key handling of their own
 * inside this surface either — pair a `calendarKeys()`/`rangePreview()`
 * mixin from the behavior layer, applied where the calendar itself is
 * composed, for a live, arrow-key-driven picker over the same markup.
 *
 * @param handle Runtime handle carrying the host's {@link Popover} props.
 * @returns The render function producing the surface's markup.
 * @example
 * <DatePicker.Dialog id="startDate-calendar">
 * 	<Calendar aria-label={monthLabel}>
 * 		<Calendar.Header>
 * 			<Calendar.PreviousButton aria-label={t("calendar.previous")} />
 * 			<Calendar.Heading>{monthLabel}</Calendar.Heading>
 * 			<Calendar.NextButton aria-label={t("calendar.next")} />
 * 		</Calendar.Header>
 * 		<Calendar.Grid aria-label={monthLabel}>...</Calendar.Grid>
 * 	</Calendar>
 * </DatePicker.Dialog>
 */
DatePicker.Dialog = function DatePickerDialog(handle: Handle<DatePicker.DialogProps>) {
	return () => {
		let { placement, children, mix, ...rest } = handle.props;
		let resolvedPlacement = placement ?? DEFAULT_DIALOG_PLACEMENT;

		return (
			<Popover
				{...rest}
				placement={resolvedPlacement}
				mix={[attrs({ role: DEFAULT_DIALOG_ROLE }), p(4), outline("none"), mix]}
			>
				{children}
			</Popover>
		);
	};
};
