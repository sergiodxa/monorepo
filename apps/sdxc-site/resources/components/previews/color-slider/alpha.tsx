/**
 * Live example for an alpha `ColorSlider` whose track is painted at a fixed hue. The
 * channel is one native range input over a checkerboard gradient, so it drags, steps by
 * keyboard and submits before any script loads and needs no island of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { maxIs } from "@sdxc/u/size";
import { ColorSlider } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<ColorSlider channel="alpha" min={0} max={1} defaultValue={1} mix={[maxIs("20rem")]}>
	<ColorSlider.Track hue={210}>
		<ColorSlider.Thumb aria-label="Overlay opacity" />
	</ColorSlider.Track>
</ColorSlider>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Opacity channel",
	code: CODE,
	render: () => (
		<ColorSlider channel="alpha" min={0} max={1} defaultValue={1} mix={[maxIs("20rem")]}>
			<ColorSlider.Track hue={210}>
				<ColorSlider.Thumb aria-label="Overlay opacity" />
			</ColorSlider.Track>
		</ColorSlider>
	),
};
