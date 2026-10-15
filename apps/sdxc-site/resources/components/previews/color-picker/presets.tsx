/**
 * Live example island for a `ColorPicker` whose panel offers saved presets. The popover
 * opens from the swatch trigger with no script; keeping the field, the trigger's swatch
 * and the picked preset showing one color is the consumer's, so the island listens to
 * the preset group and the field and re-renders both from the color they settle on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { font } from "@sdxc/u/typography";
import { ColorPicker, ColorSwatchPicker, Input, Label } from "@sdxc/ui";
import { parseColor } from "@sdxc/ui/utils";
import { clientEntry, on } from "remix/component";

/** The brand colors an Acme workspace keeps saved, offered as one-click picks. */
const PRESETS = [
	{ value: "#3b82f6", label: "Acme blue" },
	{ value: "#8b5cf6", label: "Violet" },
	{ value: "#16a34a", label: "Green" },
	{ value: "#f97316", label: "Orange" },
];

/** The source the page shows, matching the markup below. */
const CODE = `let color = "#3b82f6";

function pick(event: Event) {
	let next = (event.target as HTMLInputElement).value;
	if (parseColor(next) === null) return;
	color = next;
	void handle.update();
}

<ColorPicker>
	<Label htmlFor="brand-color">Brand color</Label>
	<ColorPicker.Group>
		<Input
			id="brand-color"
			type="text"
			name="brandColor"
			value={color}
			mix={[font("mono"), on<HTMLInputElement, "change">("change", pick)]}
		/>
		<ColorPicker.Trigger
			commandfor="brand-color-panel"
			command="toggle-popover"
			aria-label="Choose a saved brand color"
			value={color}
		/>
	</ColorPicker.Group>
	<ColorPicker.Dialog id="brand-color-panel">
		<ColorSwatchPicker
			aria-label="Saved brand colors"
			name="savedBrandColor"
			mix={[on<HTMLDivElement, "change">("change", pick)]}
		>
			{PRESETS.map((preset) => (
				<ColorSwatchPicker.Swatch
					key={preset.value}
					value={preset.value}
					aria-label={preset.label}
					checked={preset.value === color}
				/>
			))}
		</ColorSwatchPicker>
	</ColorPicker.Dialog>
</ColorPicker>`;

/** A brand color field whose panel jumps to a saved preset, hydrated so every view agrees. */
export const ColorPickerPresets = clientEntry(
	import.meta.url,
	function ColorPickerPresets(handle: Handle) {
		let color = "#3b82f6";

		/** Takes a typed or picked color only once it parses, so the swatch never paints garbage. */
		function pick(event: Event) {
			let next = (event.target as HTMLInputElement).value;
			if (parseColor(next) === null) return;
			color = next;
			void handle.update();
		}

		return () => (
			<ColorPicker>
				<Label htmlFor="example-color-picker-presets">Brand color</Label>
				<ColorPicker.Group>
					<Input
						id="example-color-picker-presets"
						type="text"
						name="brandColor"
						value={color}
						mix={[font("mono"), on<HTMLInputElement, "change">("change", pick)]}
					/>
					<ColorPicker.Trigger
						commandfor="example-color-picker-presets-panel"
						command="toggle-popover"
						aria-label="Choose a saved brand color"
						value={color}
					/>
				</ColorPicker.Group>
				<ColorPicker.Dialog id="example-color-picker-presets-panel">
					<ColorSwatchPicker
						aria-label="Saved brand colors"
						name="savedBrandColor"
						mix={[on<HTMLDivElement, "change">("change", pick)]}
					>
						{PRESETS.map((preset) => (
							<ColorSwatchPicker.Swatch
								key={preset.value}
								value={preset.value}
								aria-label={preset.label}
								checked={preset.value === color}
							/>
						))}
					</ColorSwatchPicker>
				</ColorPicker.Dialog>
			</ColorPicker>
		);
	},
);

/** What the preview registry reads: the title, the source to show, and the island to draw. */
export default {
	title: "Saved presets",
	code: CODE,
	render: () => <ColorPickerPresets />,
};
