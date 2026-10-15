/**
 * Live example for a `ColorField` set to the `rgb` notation with a hint beneath it. The
 * `format` prop only swaps the native `pattern` the input checks, so the field validates
 * and submits before any script loads and needs no island of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ColorField } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<ColorField
	label="Brand color"
	name="brandColor"
	format="rgb"
	defaultValue="rgb(16, 185, 129)"
	description="Buttons and links across your Acme workspace use this color."
/>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "RGB with a hint",
	code: CODE,
	render: () => (
		<ColorField
			label="Brand color"
			name="brandColor"
			format="rgb"
			defaultValue="rgb(16, 185, 129)"
			description="Buttons and links across your Acme workspace use this color."
		/>
	),
};
