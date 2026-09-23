/**
 * Live preview island for `ColorArea`. The square paints every saturation and brightness
 * for one hue and overlays two native range inputs, each operable on its own by keyboard.
 * Dragging the square as one two-dimensional gesture is the consumer's to apply, so the
 * preview carries the same `colorAreaDrag()` wiring a reader would write, with the
 * `data-color-area-axis` markers that tell the mixin which input tracks which axis, and
 * the `ui:color-area-change` listener that turns the settled pair into a real color.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { fg } from "@sdxc/u/color";
import { hstack, vstack } from "@sdxc/u/layout";
import { font, text, weight } from "@sdxc/u/typography";
import { ColorArea, ColorSwatch } from "@sdxc/ui";
import { colorAreaDrag } from "@sdxc/ui/mixins";
import { formatHex, hsvToRgb } from "@sdxc/ui/utils";
import { clientEntry, on } from "remix/ui";

/** The hue the square paints for, the one axis it does not edit. */
const HUE = 210;

/** The source the page shows, matching the markup below. */
const CODE = `let saturation = 80;
let brightness = 70;

<div mix={[vstack({ gap: 3, align: "start" })]}>
	<ColorArea
		aria-label="Saturation and brightness"
		hue={HUE}
		saturation={saturation}
		value={brightness}
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
		<ColorSwatch
			size="lg"
			shape="rounded"
			value={formatHex({ ...hsvToRgb({ h: HUE, s: saturation, v: brightness }), a: 1 })}
		/>
		<div mix={[vstack({ gap: 0, align: "start" })]}>
			<span mix={[font("mono"), text("sm"), weight("medium")]}>
				{formatHex({ ...hsvToRgb({ h: HUE, s: saturation, v: brightness }), a: 1 })}
			</span>
			<span mix={[text("xs"), fg("neutral")]}>
				hue {HUE}° · saturation {Math.round(saturation)}% · brightness {Math.round(brightness)}%
			</span>
		</div>
	</div>
</div>`;

/** A picking square whose pointer gesture moves both axes at once, hydrated so the drag lands. */
export const ColorAreaPreview = clientEntry(
	"/resources/components/previews/color-area.tsx#ColorAreaPreview",
	function ColorAreaPreview(handle: Handle) {
		let saturation = 80;
		let brightness = 70;

		return () => {
			let hex = formatHex({ ...hsvToRgb({ h: HUE, s: saturation, v: brightness }), a: 1 });

			return (
				<div mix={[vstack({ gap: 3, align: "start" })]}>
					<ColorArea
						aria-label="Saturation and brightness"
						hue={HUE}
						saturation={saturation}
						value={brightness}
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
						<ColorSwatch size="lg" shape="rounded" value={hex} />
						<div mix={[vstack({ gap: 0, align: "start" })]}>
							<span mix={[font("mono"), text("sm"), weight("medium")]}>{hex}</span>
							<span mix={[text("xs"), fg("neutral")]}>
								hue {HUE}° · saturation {Math.round(saturation)}% · brightness{" "}
								{Math.round(brightness)}%
							</span>
						</div>
					</div>
				</div>
			);
		};
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: CODE, render: () => <ColorAreaPreview /> };
