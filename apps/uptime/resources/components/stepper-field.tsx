/**
 * Client island: a `NumberField` whose decrement/increment buttons actually
 * step the value, since `stepUp()`/`stepDown()` are script-only. The buttons
 * declare their step as an Invoker Command targeting the input, and
 * `@sdxc/ui/mixins`' `stepper()` turns those into real steps once hydrated,
 * which is why this ships as a `clientEntry`.
 *
 * No-JS baseline: the field is a native `<input type="number">` carrying the
 * same `name`, `min`, `max` and `defaultValue` either way, so typed entry and
 * the submitted form body stay identical with scripting off; only the buttons go quiet.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { Description, Label, NumberField } from "@sdxc/ui";
import {
	NUMBER_FIELD_STEP_DOWN_COMMAND,
	NUMBER_FIELD_STEP_UP_COMMAND,
	stepper,
} from "@sdxc/ui/mixins";
import { clientEntry } from "remix/ui";

/** Declared as a `type` alias so it satisfies `SerializableProps`. */
type StepperFieldProps = {
	/** Id given to the input, linking it to its `Label` and to both buttons' `commandfor`. */
	id: string;
	/** Submitted field name, identical with and without JavaScript. */
	name: string;
	label: string;
	/** Muted helper text rendered below the control. */
	description?: string;
	/** Accessible name for the decrement button, whose content is a bare glyph. */
	decrementLabel: string;
	/** Accessible name for the increment button, whose content is a bare glyph. */
	incrementLabel: string;
	min?: number;
	max?: number;
	step?: number;
	defaultValue: number;
	required?: boolean;
};

/** A `NumberField` wired to `stepper()`, so its +/- buttons step the value once hydrated. */
export const StepperField = clientEntry(
	"/resources/components/stepper-field.tsx#StepperField",
	function StepperField(handle: Handle<StepperFieldProps>) {
		return () => {
			let {
				id,
				name,
				label,
				description,
				decrementLabel,
				incrementLabel,
				min,
				max,
				step,
				defaultValue,
				required,
			} = handle.props;

			return (
				<NumberField>
					<Label htmlFor={id}>{label}</Label>
					<NumberField.Group mix={[stepper()]}>
						<NumberField.DecrementButton
							aria-label={decrementLabel}
							command={NUMBER_FIELD_STEP_DOWN_COMMAND}
							commandfor={id}
						/>
						<NumberField.Input
							id={id}
							name={name}
							required={required}
							min={min}
							max={max}
							step={step}
							defaultValue={defaultValue}
						/>
						<NumberField.IncrementButton
							aria-label={incrementLabel}
							command={NUMBER_FIELD_STEP_UP_COMMAND}
							commandfor={id}
						/>
					</NumberField.Group>
					{description && <Description>{description}</Description>}
				</NumberField>
			);
		};
	},
);

export default StepperField;
