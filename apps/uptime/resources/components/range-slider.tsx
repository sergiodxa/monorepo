/**
 * A single-value range control matching the visual language of `Field` (bold
 * label, muted description): `@pkg/ui`'s `Slider` for the track/thumb, paired
 * with a live numeric readout (an `<output>` kept in sync as the user drags) plus
 * low/high range labels and optional helper text.
 *
 * `Slider.Thumb`/`Slider.Output` only render the value that was current at
 * render time — there's no mixin for a *live*, in-progress readout as the
 * thumb drags: the one mixin whose name suggests it (`range-preview.ts`) is
 * built around a `CalendarModel` and calendar day cells for a `RangeCalendar`
 * grid's hover/focus preview of a pending date range, an unrelated behavior
 * with no applicability to a plain single-thumb slider. So this component
 * keeps a small, local `on("input", ...)` listener on the thumb — the same
 * primitive every such mixin is itself built from — to write the scaled,
 * unit-suffixed value into the paired `<output>` on every drag, replacing the
 * previous injected `<script>` with a delegated document-wide listener.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { fg } from "@pkg/u/color";
import { flex, flexCol, gap, items, justify } from "@pkg/u/layout";
import { mbe } from "@pkg/u/size";
import { fontSize, tabularNums, weight } from "@pkg/u/typography";
import { Description, Label, Slider } from "@pkg/ui";
import { on } from "remix/ui";

namespace RangeSlider {
	export interface Props {
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
		rangeLabels: readonly [low: string, high: string];
	}
}

/**
 * Writes the thumb's scaled, unit-suffixed value into its paired `<output>` on
 * every `input` event — the paired output is found by its `for` attribute
 * matching the thumb's own `id`, the same native association
 * `Slider.Output`/`Slider.Thumb` already carry.
 */
function syncOutput(scale: number, unit: string) {
	return on<HTMLInputElement, "input">("input", (event) => {
		let input = event.currentTarget;
		let out = document.querySelector<HTMLOutputElement>(`output[for="${input.id}"]`);
		if (!out) return;
		out.textContent = `${Math.round(input.valueAsNumber / scale)}${unit}`;
	});
}

/** Slider + live readout + low/high range labels + optional helper text. */
export default function RangeSlider(handle: Handle<RangeSlider.Props>) {
	return () => {
		let {
			label,
			description: helperText,
			name,
			min,
			max,
			step = 1,
			defaultValue,
			scale = 1,
			unit = "",
			rangeLabels: [low, high],
		} = handle.props;
		let descriptionId = helperText ? `${name}-description` : undefined;

		return (
			<div mix={[flex(), flexCol(), gap("0.5rem"), mbe("28px")]}>
				<Slider min={min} max={max} defaultValue={defaultValue}>
					<div
						mix={[flex(), justify("between"), items("baseline"), fontSize("0.875rem"), weight(600)]}
					>
						<Label htmlFor={name}>{label}</Label>
						<Slider.Output htmlFor={name} mix={[fg("brand"), tabularNums()]}>
							{Math.round(defaultValue / scale)}
							{unit}
						</Slider.Output>
					</div>
					<Slider.Track>
						<Slider.Thumb
							id={name}
							name={name}
							step={step}
							aria-describedby={descriptionId}
							mix={[syncOutput(scale, unit)]}
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
}
