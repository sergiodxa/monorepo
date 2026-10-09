/**
 * Live example for a `ColorSwatch` painting a translucent color as a large circle. The
 * swatch lays the color over a checkerboard, so the transparency reads as transparency,
 * and the whole example is static markup with no island of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ColorSwatch } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<ColorSwatch value="rgb(16 185 129 / 0.4)" shape="circle" size="lg" />`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Translucent circle",
	code: CODE,
	render: () => <ColorSwatch value="rgb(16 185 129 / 0.4)" shape="circle" size="lg" />,
};
