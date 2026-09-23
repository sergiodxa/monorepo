/**
 * Live preview island for `ColorSlider`. Each channel is one native range input on a
 * gradient track, so each one drags, steps by keyboard and submits on its own. None of
 * them can notice a sibling moving, so the group carries the `channelSync()` wiring a
 * reader would write — the `data-channel` marker on every thumb, which is what lets the
 * mixin keep each track's gradient current with the others and report all four values
 * together through `ui:color-channel-change`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { fg } from "@sdxc/u/color";
import { hstack, vstack } from "@sdxc/u/layout";
import { is, maxIs } from "@sdxc/u/size";
import { font, text, weight } from "@sdxc/u/typography";
import { ColorSlider, ColorSwatch, Label } from "@sdxc/ui";
import { channelSync } from "@sdxc/ui/mixins";
import { formatHsl, hslToRgb } from "@sdxc/ui/utils";
import { clientEntry, on } from "remix/ui";

/** Where the four channels start, the color a theme editor opens on. */
const OPENING = { hue: 210, saturation: 84, lightness: 56, alpha: 100 };

/** The source the page shows, matching the markup below. */
const CODE = `let channels = { ...OPENING };

<div
	mix={[
		vstack({ gap: 4, align: "stretch" }),
		is("100%"),
		maxIs("24rem"),
		channelSync(),
		on<HTMLDivElement, "ui:color-channel-change">("ui:color-channel-change", (event) => {
			channels = { ...channels, ...event.values };
			void handle.update();
		}),
	]}
>
	{CHANNELS.map((channel) => (
		<div key={channel.name} mix={[vstack({ gap: 1, align: "stretch" })]}>
			<div mix={[hstack({ gap: 2, align: "center" })]}>
				<Label htmlFor={\`preview-channel-\${channel.name}\`} mix={[is("100%")]}>
					{channel.label}
				</Label>
				<output
					htmlFor={\`preview-channel-\${channel.name}\`}
					mix={[font("mono"), text("xs"), fg("neutral")]}
				>
					{Math.round(channels[channel.name])}
					{channel.unit}
				</output>
			</div>
			<ColorSlider channel={channel.name} value={channels[channel.name]}>
				<ColorSlider.Track hue={channels.hue}>
					<ColorSlider.Thumb
						id={\`preview-channel-\${channel.name}\`}
						data-channel={channel.name}
						aria-label={channel.label}
					/>
				</ColorSlider.Track>
			</ColorSlider>
		</div>
	))}

	<div mix={[hstack({ gap: 3, align: "center" })]}>
		<ColorSwatch size="lg" shape="rounded" value={swatch} />
		<span mix={[font("mono"), text("sm"), weight("medium")]}>{swatch}</span>
	</div>
</div>`;

/** The four channels a theme editor exposes, in the order it stacks them. */
const CHANNELS = [
	{ name: "hue" as const, label: "Hue", unit: "°" },
	{ name: "saturation" as const, label: "Saturation", unit: "%" },
	{ name: "lightness" as const, label: "Lightness", unit: "%" },
	{ name: "alpha" as const, label: "Opacity", unit: "%" },
];

/** An HSL channel stack whose tracks follow each other, hydrated so the group reports itself. */
export const ColorSliderPreview = clientEntry(
	"/resources/components/previews/color-slider.tsx#ColorSliderPreview",
	function ColorSliderPreview(handle: Handle) {
		let channels = { ...OPENING };

		return () => {
			let rgb = hslToRgb({ h: channels.hue, s: channels.saturation, l: channels.lightness });
			let swatch = formatHsl({ ...rgb, a: channels.alpha / 100 });

			return (
				<div
					mix={[
						vstack({ gap: 4, align: "stretch" }),
						is("100%"),
						maxIs("24rem"),
						channelSync(),
						on<HTMLDivElement, "ui:color-channel-change">("ui:color-channel-change", (event) => {
							channels = { ...channels, ...event.values };
							void handle.update();
						}),
					]}
				>
					{CHANNELS.map((channel) => (
						<div key={channel.name} mix={[vstack({ gap: 1, align: "stretch" })]}>
							<div mix={[hstack({ gap: 2, align: "center" })]}>
								<Label htmlFor={`preview-channel-${channel.name}`} mix={[is("100%")]}>
									{channel.label}
								</Label>
								<output
									htmlFor={`preview-channel-${channel.name}`}
									mix={[font("mono"), text("xs"), fg("neutral")]}
								>
									{Math.round(channels[channel.name])}
									{channel.unit}
								</output>
							</div>
							<ColorSlider channel={channel.name} value={channels[channel.name]}>
								<ColorSlider.Track hue={channels.hue}>
									<ColorSlider.Thumb
										id={`preview-channel-${channel.name}`}
										data-channel={channel.name}
										aria-label={channel.label}
									/>
								</ColorSlider.Track>
							</ColorSlider>
						</div>
					))}

					<div mix={[hstack({ gap: 3, align: "center" })]}>
						<ColorSwatch size="lg" shape="rounded" value={swatch} />
						<span mix={[font("mono"), text("sm"), weight("medium")]}>{swatch}</span>
					</div>
				</div>
			);
		};
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: CODE, render: () => <ColorSliderPreview /> };
