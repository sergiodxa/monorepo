/**
 * Live example island for a vertical `Slider`. The track's fill comes from the value the
 * root renders with, so the island re-renders from the thumb's own `input` event for the
 * fill to follow a drag.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { Slider } from "@sdxc/ui";
import { clientEntry, on } from "remix/component";

/** The source the page shows, matching the markup below. */
const CODE = `let gain = 6;

function readGain(event: Event) {
	if (!(event.target instanceof HTMLInputElement)) return;
	gain = Number(event.target.value);
	void handle.update();
}

<Slider
	orientation="vertical"
	min={0}
	max={10}
	value={gain}
	mix={[on<HTMLDivElement, "input">("input", readGain)]}
>
	<Slider.Track>
		<Slider.Thumb aria-label="Gain at 250 Hz" />
	</Slider.Track>
</Slider>`;

/** One equalizer band, hydrated so the fill follows the thumb. */
export const VerticalSlider = clientEntry(import.meta.url, function VerticalSlider(handle: Handle) {
	let gain = 6;

	/** Records the dragged value so the track's fill matches the thumb. */
	function readGain(event: Event) {
		if (!(event.target instanceof HTMLInputElement)) return;
		gain = Number(event.target.value);
		void handle.update();
	}

	return () => (
		<Slider
			orientation="vertical"
			min={0}
			max={10}
			value={gain}
			mix={[on<HTMLDivElement, "input">("input", readGain)]}
		>
			<Slider.Track>
				<Slider.Thumb aria-label="Gain at 250 Hz" />
			</Slider.Track>
		</Slider>
	);
});

/** What the preview registry reads: the title, the source to show, and the island to draw. */
export default {
	title: "Vertical",
	code: CODE,
	render: () => <VerticalSlider />,
};
