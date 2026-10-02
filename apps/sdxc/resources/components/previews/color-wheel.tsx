/**
 * Live preview island for `ColorWheel`. Its hue lives on a single native range input,
 * which renders and steps as a plain bar on its own — the ring shape and the angular drag
 * around it both arrive with `colorWheelDrag()`, so the preview attaches the same mixin a
 * reader would through the root's `mix`, and listens for `ui:color-wheel-change` to show
 * the hue the gesture settled on beside the wheel.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { hstack, vstack } from "@sdxc/u/layout";
import { font, text, weight } from "@sdxc/u/typography";
import { ColorSwatch, ColorWheel, Label } from "@sdxc/ui";
import { colorWheelDrag } from "@sdxc/ui/mixins";
import { formatHex, hslToRgb } from "@sdxc/ui/utils";
import { clientEntry, on } from "remix/component";

/** The source the page shows, matching the markup below. */
const CODE = `let hue = 210;

<div mix={[hstack({ gap: 5, align: "center" })]}>
	<ColorWheel
		aria-label="Accent hue"
		name="accentHue"
		value={hue}
		step={1}
		mix={[
			colorWheelDrag(),
			on<HTMLDivElement, "ui:color-wheel-change">("ui:color-wheel-change", (event) => {
				hue = event.hue;
				void handle.update();
			}),
		]}
	/>

	<div mix={[vstack({ gap: 3, align: "start" })]}>
		<Label>Accent hue</Label>
		<div mix={[hstack({ gap: 2, align: "center" })]}>
			<ColorSwatch size="lg" shape="circle" value={tint} />
			<div mix={[vstack({ gap: 0, align: "start" })]}>
				<span mix={[font("mono"), text("sm"), weight("medium")]}>{Math.round(hue)}°</span>
				<span mix={[font("mono"), text("xs"), fg("neutral")]}>{tint}</span>
			</div>
		</div>
		<p mix={[text("sm"), fg("neutral")]}>
			Drag around the ring, or focus it and step with the arrow keys.
		</p>
	</div>
</div>`;

/** A hue ring driving an accent color, hydrated so the root reshapes and the pointer sweeps it. */
export const ColorWheelPreview = clientEntry(
	"/resources/components/previews/color-wheel.tsx#ColorWheelPreview",
	function ColorWheelPreview(handle: Handle) {
		let hue = 210;

		return () => {
			let tint = formatHex({ ...hslToRgb({ h: hue, s: 84, l: 56 }), a: 1 });

			return (
				<div mix={[hstack({ gap: 5, align: "center" })]}>
					<ColorWheel
						aria-label="Accent hue"
						name="accentHue"
						value={hue}
						step={1}
						mix={[
							colorWheelDrag(),
							on<HTMLDivElement, "ui:color-wheel-change">("ui:color-wheel-change", (event) => {
								hue = event.hue;
								void handle.update();
							}),
						]}
					/>

					<div mix={[vstack({ gap: 3, align: "start" })]}>
						<Label>Accent hue</Label>
						<div mix={[hstack({ gap: 2, align: "center" })]}>
							<ColorSwatch size="lg" shape="circle" value={tint} />
							<div mix={[vstack({ gap: 0, align: "start" })]}>
								<span mix={[font("mono"), text("sm"), weight("medium")]}>{Math.round(hue)}°</span>
								<span mix={[font("mono"), text("xs"), fg("neutral")]}>{tint}</span>
							</div>
						</div>
						<p mix={[text("sm"), fg("neutral")]}>
							Drag around the ring, or focus it and step with the arrow keys.
						</p>
					</div>
				</div>
			);
		};
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: CODE, render: () => <ColorWheelPreview /> };
