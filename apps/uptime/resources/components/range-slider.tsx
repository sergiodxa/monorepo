/**
 * Client island: a single-value range control matching `Field`'s visual
 * language, built on `@pkg/ui`'s `Slider`, a live readout, and range labels.
 *
 * `Slider` renders the value it's given, so a drag needs the island to hold
 * that value and re-render on each `input` event — that's what keeps the
 * thumb, readout, and fill bar in agreement from one source.
 *
 * Before hydration, a native `<input type="range">` still submits `name`'s
 * value with the form, keeping the readout and fill at their initial state.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { fg } from "@pkg/u/color";
import { flex, flexCol, gap, items, justify } from "@pkg/u/layout";
import { fontSize, tabularNums, weight } from "@pkg/u/typography";
import { Description, Label, Slider } from "@pkg/ui";
import { clientEntry, on } from "remix/ui";

/** Props must be a `type` (not `interface`) to satisfy `SerializableProps`. */
type RangeSliderProps = {
	label: string;
	/** Muted helper text rendered below the range labels. */
	description?: string;
	name: string;
	min: number;
	max: number;
	step?: number;
	defaultValue: number;
	/** Divides the raw (submitted) value before display, e.g. `60` to show seconds as minutes. */
	scale?: number;
	/** Suffix appended to the displayed number, e.g. `"m"`. */
	unit?: string;
	/** Labels under the track's low/high ends, e.g. `["1m", "60m"]`. */
	rangeLabels: [low: string, high: string];
};

/** Slider + live readout + low/high range labels + optional helper text. */
export const RangeSlider = clientEntry(
	"/resources/components/range-slider.tsx#RangeSlider",
	function RangeSlider(handle: Handle<RangeSliderProps>) {
		let value = handle.props.defaultValue;

		return () => {
			let {
				label,
				description: helperText,
				name,
				min,
				max,
				step = 1,
				scale = 1,
				unit = "",
				rangeLabels: [low, high],
			} = handle.props;
			let descriptionId = helperText ? `${name}-description` : undefined;

			return (
				<div mix={[flex(), flexCol(), gap("0.5rem")]}>
					<Slider min={min} max={max} value={value}>
						<div
							mix={[
								flex(),
								justify("between"),
								items("baseline"),
								fontSize("0.875rem"),
								weight(600),
							]}
						>
							<Label htmlFor={name}>{label}</Label>
							<Slider.Output htmlFor={name} mix={[fg("brand"), tabularNums()]}>
								{Math.round(value / scale)}
								{unit}
							</Slider.Output>
						</div>
						<Slider.Track>
							<Slider.Thumb
								id={name}
								name={name}
								step={step}
								aria-describedby={descriptionId}
								mix={[
									on<HTMLInputElement, "input">("input", (event) => {
										value = event.currentTarget.valueAsNumber;
										void handle.update();
									}),
								]}
							/>
						</Slider.Track>
						<div mix={[flex(), justify("between"), fontSize("0.75rem"), fg("neutral.muted")]}>
							<span>{low}</span>
							<span>{high}</span>
						</div>
					</Slider>
					{helperText && <Description id={descriptionId}>{helperText}</Description>}
				</div>
			);
		};
	},
);
