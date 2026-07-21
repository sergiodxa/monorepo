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

import type { FieldPartsProps } from "../utils/field-parts";

import { fieldStackLayout } from "../styles/field-stack-layout";
import { resolveFieldWiring } from "../utils/resolve-field-wiring";

import { Description } from "./description";
import { FieldError } from "./field-error";
import { Input } from "./input";
import { Label } from "./label";

/**
 * Prop types for {@link TimeField}.
 */
export namespace TimeField {
	/**
	 * Semantic color role for the control's keyboard focus ring, each mapped
	 * to its matching `--ui-*` variables.
	 */
	export type Color = "primary" | "neutral" | "success" | "warning" | "danger";

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
		 * control — after the description, when both are present — and
		 * referenced by the control's `aria-describedby`. Its presence alone
		 * marks the control's `aria-invalid`, unless `aria-invalid` is set
		 * explicitly.
		 */
		errorMessage?: RemixNode;
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
 * Renders a complete time field in one call: a root element stacking
 * {@link Label}, a native `<input type="time">` control through
 * {@link Input}, and, when supplied, {@link Description} and
 * {@link FieldError} in a single column with a small gap between them. The
 * label's `for`, the control's `id`, and the control's `aria-describedby` are
 * all computed from this instance's own stable identifier, so the parts stay
 * correctly associated with no id bookkeeping left to the consumer.
 *
 * The control rides the platform's own time-entry widget — picking apart and
 * navigating between hour, minute, and (when `step` calls for it) second and
 * day-period segments is the browser's own built-in behavior, not something
 * this field tracks. `value`, `defaultValue`, `min`, and `max` all read and
 * write that widget's native `"HH:mm"` (or `"HH:mm:ss"` once `step` asks for
 * second-level granularity) string format.
 *
 * The control's keyboard focus ring reads `color` (defaulting to
 * `"neutral"`), and an invalid state — driven by `errorMessage`'s
 * presence, or an explicit `aria-invalid` override — recolors both the
 * border and ring to the semantic danger tone regardless of `color`; see
 * {@link Input} for the rest of the control's own styling contract.
 * Composing {@link Label}, {@link Input}, {@link Description}, and
 * {@link FieldError} directly instead remains available for a field whose
 * wiring or layout this wrapper doesn't cover.
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
			"aria-invalid": ariaInvalidProp,
			parts,
			mix,
			...rest
		} = handle.props;
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
