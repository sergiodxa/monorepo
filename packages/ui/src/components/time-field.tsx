/**
 * A convenience wrapper composing a labeled, described, and validated time
 * field in one call: a caption through {@link Label}, a native
 * `<input type="time">` control through {@link Input}, an optional
 * supporting passage through {@link Description}, and an optional
 * validation message through {@link FieldError}. Every id and
 * `aria-describedby` relationship between the parts is computed from this
 * instance's own stable identifier, leaving no id bookkeeping to the
 * consumer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import type { FieldPartsProps } from "../utils/field-parts.js";

import { fieldStackLayout } from "../styles/field-stack-layout.js";
import { resolveFieldWiring } from "../utils/resolve-field-wiring.js";

import { Description } from "./description.js";
import { FieldError } from "./field-error.js";
import { resolveFieldIssue } from "./form.js";
import { Input } from "./input.js";
import { Label } from "./label.js";

/**
 * Prop types for {@link TimeField}.
 */
export namespace TimeField {
	/**
	 * Semantic color role for the control's keyboard focus ring, each mapped
	 * to its matching `--ui-*` variables.
	 */
	export type Color = "brand" | "neutral" | "success" | "warning" | "danger";

	/**
	 * Per-part styling for the elements this convenience wrapper composes in
	 * one call, layered after each part's own built-in styling.
	 */
	export type PartsProps = FieldPartsProps;

	/**
	 * Props accepted by {@link TimeField}. `mix` styles the root element
	 * grouping the field's parts; style the composed label, control,
	 * description, and error individually through `parts` instead.
	 */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		/** Semantic color role for the control's focus ring. Defaults to `"neutral"` when omitted. */
		color?: Color;
		/**
		 * The field's caption, rendered through {@link Label} and associated
		 * with the control through a native `for`/`id` relationship computed
		 * from this instance's own identifier.
		 */
		label: RemixNode;
		/**
		 * Supporting copy rendered through {@link Description} beneath the
		 * control and referenced by the control's `aria-describedby`. Omit to
		 * render no description.
		 */
		description?: RemixNode;
		/**
		 * Validation message rendered through {@link FieldError} beneath the
		 * control, marking `aria-invalid` unless set explicitly. Falls back to
		 * a {@link Form}'s own `issues` message by `name`; an explicit value wins.
		 */
		errorMessage?: RemixNode;
		/**
		 * Native `autofocus`. Defaults to `true` for the first invalid field of
		 * an enclosing {@link Form}'s `issues`, landing keyboard focus on the
		 * problem with no client JavaScript; pass explicitly to override.
		 */
		autoFocus?: boolean;
		/** Native `name` submitted with an enclosing form. */
		name?: string;
		/** Current value, in the platform's `"HH:mm"` (or `"HH:mm:ss"`) format, for a control a consumer tracks itself. */
		value?: string;
		/** Initial value, in that same format, for a control left to the platform's own uncontrolled state. */
		defaultValue?: string;
		/** Earliest accepted time, in the same `"HH:mm"`/`"HH:mm:ss"` format. */
		min?: string;
		/** Latest accepted time, in the same `"HH:mm"`/`"HH:mm:ss"` format. */
		max?: string;
		/** Granularity of the accepted value, in seconds — set to `1` to surface a seconds digit alongside hours and minutes. */
		step?: number;
		/** Marks the control required for its enclosing form. */
		required?: boolean;
		/** Marks the control inert and excluded from the tab order. */
		disabled?: boolean;
		/** Marks the control's value fixed, while keeping it focusable and included in form submission. */
		readOnly?: boolean;
		/** Native autofill hint, e.g. `"bday"`. */
		autoComplete?: string;
		/** Per-part styling for this wrapper's internally composed elements. */
		parts?: PartsProps;
	}
}

/**
 * Composes {@link Label}, a native `<input type="time">` control through
 * {@link Input}, {@link Description}, and {@link FieldError} into one field,
 * computing every id and `aria-describedby` link from this identifier.
 *
 * @param handle Runtime handle carrying the root element's props and this instance's stable identifier.
 * @returns The render function producing the field's markup.
 * @example
 * <TimeField label={t("event.startTime.label")} name="startTime" required />
 * @example
 * <TimeField
 * 	label={t("event.reminderTime.label")}
 * 	min="09:00"
 * 	max="18:00"
 * 	description={t("event.reminderTime.hint")}
 * />
 * @example
 * <TimeField
 * 	label={t("event.endTime.label")}
 * 	name="endTime"
 * 	defaultValue="09:00"
 * 	errorMessage={t("event.endTime.beforeStart")}
 * />
 */
export function TimeField(handle: Handle<TimeField.Props>) {
	return () => {
		let {
			color,
			label,
			description,
			errorMessage: errorMessageProp,
			autoFocus,
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
			"aria-invalid": ariaInvalidProp,
			parts,
			mix,
			...rest
		} = handle.props;
		let { errorMessage, isFirstInvalid } = resolveFieldIssue(handle, name, errorMessageProp);
		let resolvedAutoFocus = autoFocus ?? (isFirstInvalid || undefined);
		let { resolvedColor, resolvedInvalid, descriptionId, errorId, describedBy } =
			resolveFieldWiring(handle.id, {
				color,
				errorMessage,
				description,
				ariaInvalid: ariaInvalidProp,
			});

		return (
			<div {...rest} data-slot="time-field" mix={[fieldStackLayout(), mix]}>
				<Label htmlFor={handle.id} mix={parts?.label}>
					{label}
				</Label>
				<Input
					id={handle.id}
					type="time"
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
					// oxlint-disable-next-line jsx-a11y/no-autofocus -- Not a focus grab on page load: this only ever resolves true for the first field an enclosing Form reports as invalid, so a failed submit lands the user on the problem instead of leaving them to hunt for it.
					autoFocus={resolvedAutoFocus}
					aria-invalid={resolvedInvalid}
					aria-describedby={describedBy}
					color={resolvedColor}
					mix={parts?.input}
				/>
				{description ? (
					<Description id={descriptionId} mix={parts?.description}>
						{description}
					</Description>
				) : null}
				{errorMessage ? (
					<FieldError id={errorId} mix={parts?.error}>
						{errorMessage}
					</FieldError>
				) : null}
			</div>
		);
	};
}
