/**
 * Live preview island for `ColorSwatchPicker`. Every option is a real radio input behind
 * its swatch, sharing the group's `name`, so one pick at a time and form submission are
 * the platform's. `aria-checked` on those inputs is a static attribute, so each one
 * carries the `ariaChecked()` wiring a reader would write through `parts.input`, and the
 * island reads the group's own change event to name the pick beside it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { fg } from "@sdxc/u/color";
import { flexWrap, hstack, vstack } from "@sdxc/u/layout";
import { maxIs } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { ColorSwatch, ColorSwatchPicker, Description, Label } from "@sdxc/ui";
import { ariaChecked } from "@sdxc/ui/mixins";
import { clientEntry, on } from "remix/ui";

/** The label colors a tracker offers, each named for what assistive technology announces. */
const LABEL_COLORS = [
	{ value: "#ef4444", name: "Red" },
	{ value: "#f97316", name: "Orange" },
	{ value: "#f59e0b", name: "Amber" },
	{ value: "#16a34a", name: "Green" },
	{ value: "#06b6d4", name: "Cyan" },
	{ value: "#3b82f6", name: "Blue" },
	{ value: "#8b5cf6", name: "Violet" },
	{ value: "#ec4899", name: "Pink" },
	{ value: "#64748b", name: "Slate" },
];

/** The source the page shows, matching the markup below. */
const CODE = `let picked = { value: "#3b82f6", name: "Blue" };

<div mix={[vstack({ gap: 2, align: "start" }), maxIs("22rem")]}>
	<Label id="preview-label-color">Label color</Label>

	<ColorSwatchPicker
		aria-labelledby="preview-label-color"
		name="labelColor"
		mix={[
			flexWrap(),
			on<HTMLDivElement, "change">("change", (event) => {
				let input = event.target;
				if (!(input instanceof HTMLInputElement)) return;

				picked = LABEL_COLORS.find((color) => color.value === input.value) ?? picked;
				void handle.update();
			}),
		]}
	>
		{LABEL_COLORS.map((color) => (
			<ColorSwatchPicker.Swatch
				key={color.value}
				value={color.value}
				aria-label={color.name}
				shape="rounded"
				checked={color.value === picked.value}
				parts={{ input: [ariaChecked()] }}
			/>
		))}
	</ColorSwatchPicker>

	<Description id="preview-label-color-hint">
		Shown on every issue carrying this label.
	</Description>

	<div mix={[hstack({ gap: 2, align: "center" })]}>
		<ColorSwatch value={picked.value} shape="rounded" size="sm" />
		<span mix={[text("sm")]}>
			<span mix={[weight("medium")]}>needs-triage</span>{" "}
			<span mix={[fg("neutral")]}>· {picked.name}</span>
		</span>
	</div>
</div>`;

/** A label-color picker for an issue tracker, hydrated so each option reports its state. */
export const ColorSwatchPickerPreview = clientEntry(
	"/resources/components/previews/color-swatch-picker.tsx#ColorSwatchPickerPreview",
	function ColorSwatchPickerPreview(handle: Handle) {
		let picked = { value: "#3b82f6", name: "Blue" };

		return () => (
			<div mix={[vstack({ gap: 2, align: "start" }), maxIs("22rem")]}>
				<Label id="preview-label-color">Label color</Label>

				<ColorSwatchPicker
					aria-labelledby="preview-label-color"
					name="labelColor"
					mix={[
						flexWrap(),
						on<HTMLDivElement, "change">("change", (event) => {
							let input = event.target;
							if (!(input instanceof HTMLInputElement)) return;

							picked = LABEL_COLORS.find((color) => color.value === input.value) ?? picked;
							void handle.update();
						}),
					]}
				>
					{LABEL_COLORS.map((color) => (
						<ColorSwatchPicker.Swatch
							key={color.value}
							value={color.value}
							aria-label={color.name}
							shape="rounded"
							checked={color.value === picked.value}
							parts={{ input: [ariaChecked()] }}
						/>
					))}
				</ColorSwatchPicker>

				<Description id="preview-label-color-hint">
					Shown on every issue carrying this label.
				</Description>

				<div mix={[hstack({ gap: 2, align: "center" })]}>
					<ColorSwatch value={picked.value} shape="rounded" size="sm" />
					<span mix={[text("sm")]}>
						<span mix={[weight("medium")]}>needs-triage</span>{" "}
						<span mix={[fg("neutral")]}>· {picked.name}</span>
					</span>
				</div>
			</div>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: CODE, render: () => <ColorSwatchPickerPreview /> };
