/**
 * A labeled date field built on {@link DateField}, with a
 * {@link DatePicker.Group} row for composing more than one field into a single
 * control. The calendar is the platform's: the field is a native date input, so
 * the picker, its keyboard handling and its locale all come from the browser and
 * all of it works before any script loads. Leaving `children` unset renders the
 * field on its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { outline } from "@sdxc/u/color";
import { roundedCorner } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { flex, flexCol, gap, items } from "@sdxc/u/layout";
import { mis } from "@sdxc/u/size";
import { z } from "@sdxc/u/stacking";
import { when } from "@sdxc/u/state";

import { DateField } from "./date-field.js";

/**
 * Prop types for {@link DatePicker} and its compound parts.
 */
export namespace DatePicker {
	/**
	 * Semantic color role for the fallback field's keyboard focus ring. Read
	 * only by the fallback field — {@link DatePicker.Group}'s composed
	 * control carries no `color` prop of its own.
	 */
	export type Color = DateField.Color;

	/**
	 * Every prop {@link DateField.PartsProps} accepts, applied only to the
	 * field's internally composed parts; a composed layout styles the controls
	 * inside {@link DatePicker.Group} individually.
	 */
	export interface PartsProps extends DateField.PartsProps {}

	/**
	 * Props accepted by {@link DatePicker}. Leaving `children` unset renders the
	 * field using every prop below; composing {@link DatePicker.Group} instead
	 * renders the joined row and leaves every prop below unread.
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
		 * The composed layout — typically a `Label` and a
		 * {@link DatePicker.Group} — rendered in place of the field, leaving every
		 * field above unread.
		 */
		children?: RemixNode;
	}

	/**
	 * Every native `<div>` attribute, unchanged, plus the `mix` passthrough.
	 * `children` composes the field's own control, and a second one for a
	 * range, into one visual row.
	 */
	export interface GroupProps extends TagProps<"div"> {}
}

/**
 * Renders {@link DatePicker}'s root. Leaving `children` unset renders the field,
 * passing every prop above through unchanged; composing
 * {@link DatePicker.Group} as `children` instead renders the joined row and
 * leaves those props unread.
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
 * 	</DatePicker.Group>
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
 * Renders {@link DatePicker}'s control row: a flex host laying one or more date
 * controls side by side and joining their edges, so a pair reads as one field.
 * Focus and validity are drawn the way `Group` draws them — focus by the control
 * that holds it, validity once around the row.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the row's markup.
 * @example
 * <DatePicker.Group>
 * 	<Input id="startDate" type="date" name="startDate" />
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
					/**
					 * The fields compose into one control, so the pair keeps the rounding on its own
					 * outer corners and the seam the two share is drawn once.
					 */
					when("& > *:not(:first-child)", [
						roundedCorner("start-start", "none"),
						roundedCorner("end-start", "none"),
						mis("-1px"),
					]),
					when("& > *:not(:last-child)", [
						roundedCorner("start-end", "none"),
						roundedCorner("end-end", "none"),
					]),
					/**
					 * Focus shows on the field holding it, naming which date has it where a ring around
					 * the pair names only the group. That field is raised so its ring crosses the seam.
					 */
					when("& > *:focus-visible", z(1)),
					/**
					 * Validity belongs to the pair, since a range is one value and half of one makes it
					 * invalid: one ring is drawn around the group and each field's own ring is released,
					 * so the seam shows one field needing attention.
					 */
					when(
						'&:has(> :user-invalid), &:has(> [aria-invalid="true"])',
						outline({ color: "danger.ring", offset: 2 }),
					),
					when(
						'& > :user-invalid:not(:focus-visible), & > [aria-invalid="true"]:not(:focus-visible)',
						/**
						 * Important so it reaches across to the cascade layer where `Input` states the field's
						 * invalid ring. The selector excludes `:focus-visible`, so a field being filled in still
						 * shows its own focus ring.
						 */
						raw({ outline: "none !important" }),
					),
					mix,
				]}
			/>
		);
	};
};
