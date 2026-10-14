/**
 * Live example for a `ColorSwatchPicker` drawn as large circles. Each option is a native
 * radio sharing the group's generated name, so picking one and submitting it work before
 * any script loads and the example needs no island of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ColorSwatchPicker } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<ColorSwatchPicker aria-label="Brand color">
	<ColorSwatchPicker.Swatch value="#f97316" aria-label="Orange" shape="circle" size="lg" />
	<ColorSwatchPicker.Swatch value="#a855f7" aria-label="Purple" shape="circle" size="lg" />
</ColorSwatchPicker>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Large circles",
	code: CODE,
	render: () => (
		<ColorSwatchPicker aria-label="Brand color">
			<ColorSwatchPicker.Swatch value="#f97316" aria-label="Orange" shape="circle" size="lg" />
			<ColorSwatchPicker.Swatch value="#a855f7" aria-label="Purple" shape="circle" size="lg" />
		</ColorSwatchPicker>
	),
};
