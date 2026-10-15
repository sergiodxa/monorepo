/**
 * Live preview island for `ColorPicker`, composed as the trigger-and-panel layout rather
 * than the plain field it falls back to, so there is a picking surface to open. The
 * popover, the swatch trigger and every control inside work on their own; what the island
 * adds is the wiring each surface expects — `colorAreaDrag()` for the square's
 * two-dimensional gesture, `colorWheelDrag()` for the hue ring, `channelSync()` so the
 * alpha track's gradient follows the live hue, and one listener per surface so the field,
 * the trigger's swatch and the preset row all show the same color.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ColorChannelChangeEvent } from "@sdxc/ui/mixins";
import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { basis, grow, hstack, vstack } from "@sdxc/u/layout";
import { bs, is, minIs } from "@sdxc/u/size";
import { font, text } from "@sdxc/u/typography";
import {
	ColorArea,
	ColorPicker,
	ColorSlider,
	ColorSwatchPicker,
	ColorWheel,
	Input,
	Label,
	Separator,
} from "@sdxc/ui";
import { channelSync, colorAreaDrag, colorWheelDrag } from "@sdxc/ui/mixins";
import { formatHex, hsvToRgb, parseColor, rgbToHsv } from "@sdxc/ui/utils";
import { clientEntry, on } from "remix/component";

/** The starting brand color, kept as the three channels every surface in the panel edits. */
const OPENING_COLOR = { hue: 210, saturation: 80, brightness: 70 };

/** Presets a team keeps around, so the panel offers a jump as well as a drag. */
const PRESETS = [
	{ value: "#3b82f6", label: "Brand blue" },
	{ value: "#8b5cf6", label: "Violet" },
	{ value: "#16a34a", label: "Green" },
	{ value: "#f97316", label: "Orange" },
	{ value: "#ef4444", label: "Red" },
];

/** The source the page shows, matching the markup below. */
const CODE = `let { hue, saturation, brightness } = OPENING_COLOR;
let alpha = 1;
let hex = formatHex({ ...hsvToRgb({ h: hue, s: saturation, v: brightness }), a: alpha });

// channelSync() reports every channel together rather than one at a time, so the
// sliders and the area stay one color rather than two views of different ones.
function moveChannel(event: ColorChannelChangeEvent) {
	if (typeof event.values.saturation === "number") saturation = event.values.saturation;
	if (typeof event.values.alpha === "number") alpha = event.values.alpha;
	void handle.update();
}

<ColorPicker>
	<Label htmlFor="preview-brand-color">Brand color</Label>

	<ColorPicker.Group>
		<Input
			id="preview-brand-color"
			type="text"
			name="brandColor"
			value={hex}
			mix={[font("mono")]}
		/>
		<ColorPicker.Trigger
			commandfor="preview-brand-color-panel"
			command="toggle-popover"
			aria-label="Open the color picker"
			value={hex}
		/>
	</ColorPicker.Group>

	<ColorPicker.Dialog id="preview-brand-color-panel" mix={[is("16rem")]}>
		<ColorArea
			aria-label="Saturation and brightness"
			hue={hue}
			saturation={saturation}
			value={brightness}
			style={{ "--ui-color-area-size": "12rem" }}
			mix={[
				colorAreaDrag(),
				on<HTMLDivElement, "ui:color-area-change">("ui:color-area-change", (event) => {
					saturation = event.x;
					brightness = event.y;
					void handle.update();
				}),
			]}
		>
			<ColorArea.SaturationThumb data-color-area-axis="x" aria-label="Saturation" />
			<ColorArea.ValueThumb data-color-area-axis="y" aria-label="Brightness" />
		</ColorArea>

		<div mix={[hstack({ gap: 3, align: "center" })]}>
			<ColorWheel
				aria-label="Hue"
				value={hue}
				mix={[
					is("5rem"),
					bs("5rem"),
					colorWheelDrag(),
					on<HTMLDivElement, "ui:color-wheel-change">("ui:color-wheel-change", (event) => {
						hue = event.hue;
						void handle.update();
					}),
				]}
			/>
			<div
				mix={[
					vstack({ gap: 2, align: "stretch" }),
					basis(0),
					grow(),
					minIs(0),
					channelSync(),
					on<HTMLDivElement, "ui:color-channel-change">("ui:color-channel-change", moveChannel),
				]}
			>
				<ColorSlider channel="saturation" value={saturation}>
					<ColorSlider.Track hue={hue}>
						<ColorSlider.Thumb data-channel="saturation" aria-label="Saturation" />
					</ColorSlider.Track>
				</ColorSlider>
				<ColorSlider channel="alpha" value={alpha}>
					<ColorSlider.Track hue={hue}>
						<ColorSlider.Thumb data-channel="alpha" aria-label="Opacity" />
					</ColorSlider.Track>
				</ColorSlider>
			</div>
		</div>

		<Separator />

		<ColorSwatchPicker
			aria-label="Saved colors"
			name="brandColorPreset"
			mix={[on<HTMLDivElement, "change">("change", choosePreset)]}
		>
			{PRESETS.map((preset) => (
				<ColorSwatchPicker.Swatch
					key={preset.value}
					value={preset.value}
					aria-label={preset.label}
				/>
			))}
		</ColorSwatchPicker>

		<span mix={[font("mono"), text("xs"), fg("neutral")]}>{hex}</span>
	</ColorPicker.Dialog>
</ColorPicker>`;

/** A swatch trigger over a full picking panel, hydrated so every surface in it picks. */
export const ColorPickerPreview = clientEntry(
	import.meta.url,
	function ColorPickerPreview(handle: Handle) {
		let { hue, saturation, brightness } = OPENING_COLOR;
		let alpha = 1;

		/**
		 * Reads a saved color back into the three channels the rest of the panel is driven
		 * by, since a preset is one hex string and everything else here — the area, the
		 * wheel, the sliders, the field — is a position in hue, saturation and brightness.
		 */

		/**
		 * Reads a settled slider back into the channels the panel is driven by. `channelSync()`
		 * reports every channel together rather than one at a time, so the sliders and the
		 * area stay one color rather than two views of different ones.
		 */
		function moveChannel(event: ColorChannelChangeEvent) {
			if (typeof event.values.saturation === "number") saturation = event.values.saturation;
			if (typeof event.values.alpha === "number") alpha = event.values.alpha;
			void handle.update();
		}

		function choosePreset(event: Event) {
			let chosen = (event.target as HTMLInputElement).value;
			let rgb = parseColor(chosen);
			if (rgb === null) return;

			let hsv = rgbToHsv(rgb);
			hue = hsv.h;
			saturation = hsv.s;
			brightness = hsv.v;
			void handle.update();
		}

		return () => {
			let hex = formatHex({ ...hsvToRgb({ h: hue, s: saturation, v: brightness }), a: alpha });

			return (
				<ColorPicker>
					<Label htmlFor="preview-brand-color">Brand color</Label>

					<ColorPicker.Group>
						<Input
							id="preview-brand-color"
							type="text"
							name="brandColor"
							value={hex}
							mix={[font("mono")]}
						/>
						<ColorPicker.Trigger
							commandfor="preview-brand-color-panel"
							command="toggle-popover"
							aria-label="Open the color picker"
							value={hex}
						/>
					</ColorPicker.Group>

					<ColorPicker.Dialog id="preview-brand-color-panel" mix={[is("16rem")]}>
						<ColorArea
							aria-label="Saturation and brightness"
							hue={hue}
							saturation={saturation}
							value={brightness}
							style={{ "--ui-color-area-size": "12rem" }}
							mix={[
								colorAreaDrag(),
								on<HTMLDivElement, "ui:color-area-change">("ui:color-area-change", (event) => {
									saturation = event.x;
									brightness = event.y;
									void handle.update();
								}),
							]}
						>
							<ColorArea.SaturationThumb data-color-area-axis="x" aria-label="Saturation" />
							<ColorArea.ValueThumb data-color-area-axis="y" aria-label="Brightness" />
						</ColorArea>

						<div mix={[hstack({ gap: 3, align: "center" })]}>
							<ColorWheel
								aria-label="Hue"
								value={hue}
								mix={[
									is("5rem"),
									bs("5rem"),
									colorWheelDrag(),
									on<HTMLDivElement, "ui:color-wheel-change">("ui:color-wheel-change", (event) => {
										hue = event.hue;
										void handle.update();
									}),
								]}
							/>
							<div
								mix={[
									vstack({ gap: 2, align: "stretch" }),
									basis(0),
									grow(),
									minIs(0),
									channelSync(),
									on<HTMLDivElement, "ui:color-channel-change">(
										"ui:color-channel-change",
										moveChannel,
									),
								]}
							>
								<ColorSlider channel="saturation" value={saturation}>
									<ColorSlider.Track hue={hue}>
										<ColorSlider.Thumb data-channel="saturation" aria-label="Saturation" />
									</ColorSlider.Track>
								</ColorSlider>
								<ColorSlider channel="alpha" value={alpha}>
									<ColorSlider.Track hue={hue}>
										<ColorSlider.Thumb data-channel="alpha" aria-label="Opacity" />
									</ColorSlider.Track>
								</ColorSlider>
							</div>
						</div>

						<Separator />

						<ColorSwatchPicker
							aria-label="Saved colors"
							name="brandColorPreset"
							mix={[on<HTMLDivElement, "change">("change", choosePreset)]}
						>
							{PRESETS.map((preset) => (
								<ColorSwatchPicker.Swatch
									key={preset.value}
									value={preset.value}
									aria-label={preset.label}
								/>
							))}
						</ColorSwatchPicker>

						<span mix={[font("mono"), text("xs"), fg("neutral")]}>{hex}</span>
					</ColorPicker.Dialog>
				</ColorPicker>
			);
		};
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: CODE, render: () => <ColorPickerPreview /> };
