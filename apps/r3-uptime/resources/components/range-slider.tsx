/**
 * A native `<input type="range">` paired with a live numeric readout (an `<output>`
 * kept in sync as the user drags) plus low/high range labels and optional helper
 * text, matching the visual language of `Field` (bold label, muted description).
 *
 * remix/ui's JSX exposes no inline event-handler attribute, and this app's
 * client-side JS is otherwise limited to small hydrated islands reserved for
 * behavior the server truly cannot express — a live drag readout doesn't need a full
 * island's reconciled state, so it's kept in sync by one small static `<script>`
 * instead (a delegated `input` listener keyed off the `data-live-output` attribute).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { attrs, css } from "remix/ui";

import { neutral, primary } from "~/resources/theme";

/**
 * Delegated `input` listener: for any element carrying `data-live-output`, writes its
 * scaled (`data-scale`) and unit-suffixed (`data-unit`) value into the `<output>`
 * whose `name` matches the input's `name`. Injected once per page that renders a
 * {@link RangeSlider}.
 */
export const RANGE_SLIDER_SCRIPT =
	"document.addEventListener('input',function(e){" +
	"var t=e.target;" +
	"if(!t||!t.hasAttribute||!t.hasAttribute('data-live-output'))return;" +
	"var out=document.querySelector('output[name=\"'+t.name+'\"]');" +
	"if(!out)return;" +
	"var scale=Number(t.getAttribute('data-scale')||'1');" +
	"var unit=t.getAttribute('data-unit')||'';" +
	"out.textContent=Math.round(Number(t.value)/scale)+unit;" +
	"});";

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

const wrapper = css({ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 });

const labelRow = css({
	display: "flex",
	justifyContent: "space-between",
	alignItems: "baseline",
	fontSize: "0.875rem",
	fontWeight: 600,
});

const output = css({ color: primary[600], fontVariantNumeric: "tabular-nums" });

const track = css({
	width: "100%",
	appearance: "none",
	height: 6,
	borderRadius: 999,
	background: neutral[200],
	cursor: "pointer",
	"&::-webkit-slider-thumb": {
		appearance: "none",
		width: 18,
		height: 18,
		borderRadius: "50%",
		background: primary[600],
		border: `2px solid ${neutral[50]}`,
		boxShadow: `0 0 0 1px ${neutral[300]}`,
	},
	"&::-moz-range-thumb": {
		width: 18,
		height: 18,
		borderRadius: "50%",
		border: `2px solid ${neutral[50]}`,
		background: primary[600],
		boxShadow: `0 0 0 1px ${neutral[300]}`,
	},
	"@media (prefers-color-scheme: dark)": {
		background: neutral[800],
		"&::-webkit-slider-thumb": { borderColor: neutral[950] },
		"&::-moz-range-thumb": { borderColor: neutral[950] },
	},
});

const rangeLabelsRow = css({
	display: "flex",
	justifyContent: "space-between",
	fontSize: "0.75rem",
	color: neutral[500],
});

const description = css({
	margin: 0,
	fontSize: "0.8125rem",
	color: neutral[500],
	"@media (prefers-color-scheme: dark)": { color: neutral[400] },
});

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

		return (
			<div mix={[wrapper]}>
				<div mix={[labelRow]}>
					<span>{label}</span>
					<output name={name} mix={[output]}>
						{Math.round(defaultValue / scale)}
						{unit}
					</output>
				</div>
				<input
					type="range"
					name={name}
					min={min}
					max={max}
					step={step}
					defaultValue={defaultValue}
					mix={[
						track,
						attrs({ "data-live-output": "", "data-scale": String(scale), "data-unit": unit }),
					]}
				/>
				<div mix={[rangeLabelsRow]}>
					<span>{low}</span>
					<span>{high}</span>
				</div>
				{helperText && <p mix={[description]}>{helperText}</p>}
				<script innerHTML={RANGE_SLIDER_SCRIPT} />
			</div>
		);
	};
}
