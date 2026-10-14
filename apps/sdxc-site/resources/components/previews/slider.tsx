/**
 * Live preview island for `Slider`. The example is a five-band equalizer, which is
 * what a run of sliders is actually for: each band a vertical track with its own
 * range, sharing the resolved value with its `<output>` through the root's context.
 * Reporting the live value is the consumer's, so the island re-renders each readout
 * from the thumb's own `input` event.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { hstack, vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { Card, Slider, Text } from "@sdxc/ui";
import { clientEntry, on } from "remix/component";

/** The bands the equalizer offers, each its own slider. */
const BANDS = [
	{ id: "60", label: "60Hz", gain: 4 },
	{ id: "250", label: "250Hz", gain: 1 },
	{ id: "1k", label: "1kHz", gain: -2 },
	{ id: "4k", label: "4kHz", gain: 2 },
	{ id: "12k", label: "12kHz", gain: 5 },
];

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const SLIDER_CODE = `let gains = { "60": 4, "250": 1, "1k": -2, "4k": 2, "12k": 5 };

<Card>
	<Card.Header>
		<Card.Title>Equalizer</Card.Title>
		<Card.Description>Gain in decibels, −12 to +12.</Card.Description>
	</Card.Header>
	<Card.Content>
		{bands.map((band) => (
			<Slider
				key={band.id}
				orientation="vertical"
				min={-12}
				max={12}
				value={gains[band.id]}
				mix={[on<HTMLDivElement, "input">("input", (event) => readGain(band.id, event))]}
			>
				<Slider.Output>{formatGain(gains[band.id])}</Slider.Output>
				<Slider.Track>
					<Slider.Thumb aria-label={\`Gain at \${band.label}\`} />
				</Slider.Track>
				<Text>{band.label}</Text>
			</Slider>
		))}
	</Card.Content>
</Card>`;

/** A five-band equalizer, hydrated so every readout follows its own thumb. */
export const SliderPreview = clientEntry(import.meta.url, function SliderPreview(handle: Handle) {
	let gains = new Map(BANDS.map((band) => [band.id, band.gain]));

	/** Records the dragged band's gain so its readout and fill agree. */
	function readGain(id: string, event: Event) {
		let target = event.target;
		if (!(target instanceof HTMLInputElement)) return;

		gains.set(id, Number(target.value));
		void handle.update();
	}

	return () => (
		<Card mix={[is("24rem")]}>
			<Card.Header>
				<Card.Title>Equalizer</Card.Title>
				<Card.Description>Gain in decibels, −12 to +12.</Card.Description>
			</Card.Header>
			<Card.Content mix={[hstack({ gap: 5, align: "end", justify: "center" })]}>
				{BANDS.map((band) => {
					let gain = gains.get(band.id) ?? 0;

					return (
						<Slider
							key={band.id}
							orientation="vertical"
							min={-12}
							max={12}
							value={gain}
							mix={[
								vstack({ gap: 2, align: "center" }),
								on<HTMLDivElement, "input">("input", (event) => readGain(band.id, event)),
							]}
						>
							<Slider.Output mix={[text("xs"), weight("medium")]}>
								{gain > 0 ? `+${gain}` : gain}
							</Slider.Output>
							<Slider.Track>
								<Slider.Thumb aria-label={`Gain at ${band.label}`} />
							</Slider.Track>
							<Text mix={[text("xs")]}>{band.label}</Text>
						</Slider>
					);
				})}
			</Card.Content>
		</Card>
	);
});

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: SLIDER_CODE, render: () => <SliderPreview /> };
