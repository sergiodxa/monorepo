/**
 * Live preview island for `NumberField`. Typing and the native arrow keys work with no
 * script, but the step buttons call `stepUp()`/`stepDown()`, which only exist in script,
 * so the preview carries the wiring a reader would write: `stepper()` on the group and
 * the `--step-up`/`--step-down` commands on the two buttons, pointing at the input.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { fg } from "@sdxc/u/color";
import { hstack, vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { Description, Label, NumberField } from "@sdxc/ui";
import {
	NUMBER_FIELD_STEP_DOWN_COMMAND,
	NUMBER_FIELD_STEP_UP_COMMAND,
	stepper,
} from "@sdxc/ui/mixins";
import { clientEntry, on } from "remix/ui";

/** What one seat costs a month, so the subtotal is worth reading. */
const PRICE_PER_SEAT = 12;

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const CODE = `let seats = "3";

<div mix={[vstack({ gap: 5, align: "stretch" })]}>
	<NumberField>
		<Label htmlFor="seats">Seats</Label>
		<NumberField.Group mix={[stepper()]}>
			<NumberField.DecrementButton
				aria-label="One seat fewer"
				command={NUMBER_FIELD_STEP_DOWN_COMMAND}
				commandfor="seats"
			/>
			<NumberField.Input
				id="seats"
				name="seats"
				min={1}
				max={50}
				step={1}
				value={seats}
				aria-describedby="seats-hint"
				mix={[
					on<HTMLInputElement, "input">("input", (event) => {
						seats = event.currentTarget.value;
						void handle.update();
					}),
				]}
			/>
			<NumberField.IncrementButton
				aria-label="One seat more"
				command={NUMBER_FIELD_STEP_UP_COMMAND}
				commandfor="seats"
			/>
		</NumberField.Group>
		<Description id="seats-hint">Hold a step button to run through the range.</Description>
	</NumberField>

	<NumberField>
		<Label htmlFor="budget">Monthly budget</Label>
		<NumberField.Group mix={[stepper({ holdIntervalMs: 40 })]}>
			<NumberField.DecrementButton
				aria-label="Lower the budget"
				command={NUMBER_FIELD_STEP_DOWN_COMMAND}
				commandfor="budget"
			/>
			<NumberField.Input
				id="budget"
				name="budget"
				min={0}
				max={10000}
				step={0.5}
				defaultValue={250}
			/>
			<NumberField.IncrementButton
				aria-label="Raise the budget"
				command={NUMBER_FIELD_STEP_UP_COMMAND}
				commandfor="budget"
			/>
		</NumberField.Group>
		<Description id="budget-hint">Steps by 0.50, as the input's own step says.</Description>
	</NumberField>

	<div mix={[hstack({ gap: 2, justify: "between" })]}>
		<span mix={[text("sm"), weight("medium")]}>Subtotal</span>
		<span mix={[text("sm")]}>{subtotal}</span>
	</div>
</div>`;

/** A seat-count and budget pair, hydrated so the step buttons and hold-repeat work. */
export const NumberFieldPreview = clientEntry(
	"/resources/components/previews/number-field.tsx#NumberFieldPreview",
	function NumberFieldPreview(handle: Handle) {
		let seats = "3";

		return () => {
			let parsed = Number.parseInt(seats, 10);
			let subtotal = Number.isNaN(parsed) ? "—" : `$${parsed * PRICE_PER_SEAT} / month`;

			return (
				<div mix={[vstack({ gap: 5, align: "stretch" }), is("20rem")]}>
					<NumberField>
						<Label htmlFor="preview-seats">Seats</Label>
						<NumberField.Group mix={[stepper()]}>
							<NumberField.DecrementButton
								aria-label="One seat fewer"
								command={NUMBER_FIELD_STEP_DOWN_COMMAND}
								commandfor="preview-seats"
							/>
							<NumberField.Input
								id="preview-seats"
								name="seats"
								min={1}
								max={50}
								step={1}
								value={seats}
								aria-describedby="preview-seats-hint"
								mix={[
									on<HTMLInputElement, "input">("input", (event) => {
										seats = event.currentTarget.value;
										void handle.update();
									}),
								]}
							/>
							<NumberField.IncrementButton
								aria-label="One seat more"
								command={NUMBER_FIELD_STEP_UP_COMMAND}
								commandfor="preview-seats"
							/>
						</NumberField.Group>
						<Description id="preview-seats-hint">
							Hold a step button to run through the range.
						</Description>
					</NumberField>

					<NumberField>
						<Label htmlFor="preview-budget">Monthly budget</Label>
						<NumberField.Group mix={[stepper({ holdIntervalMs: 40 })]}>
							<NumberField.DecrementButton
								aria-label="Lower the budget"
								command={NUMBER_FIELD_STEP_DOWN_COMMAND}
								commandfor="preview-budget"
							/>
							<NumberField.Input
								id="preview-budget"
								name="budget"
								min={0}
								max={10000}
								step={0.5}
								defaultValue={250}
								aria-describedby="preview-budget-hint"
							/>
							<NumberField.IncrementButton
								aria-label="Raise the budget"
								command={NUMBER_FIELD_STEP_UP_COMMAND}
								commandfor="preview-budget"
							/>
						</NumberField.Group>
						<Description id="preview-budget-hint">
							Steps by 0.50, as the input's own step says.
						</Description>
					</NumberField>

					<div mix={[hstack({ gap: 2, justify: "between" })]}>
						<span mix={[text("sm"), weight("medium"), fg("neutral.emphasis")]}>Subtotal</span>
						<span mix={[text("sm"), fg("neutral")]}>{subtotal}</span>
					</div>
				</div>
			);
		};
	},
);

export default { code: CODE, render: () => <NumberFieldPreview /> };
