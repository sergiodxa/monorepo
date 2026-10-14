/**
 * Live example for a large `Spinner` in the danger color, the indicator a failed request
 * shows while it retries. `spin()` resolves to plain keyframes, so the glyph rotates from
 * the server markup and the example needs no island of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Spinner } from "@sdxc/ui";
import { spin } from "@sdxc/ui/animations";

/** The source the page shows, matching the markup below. */
const CODE = `<Spinner color="danger" size="lg" mix={[spin()]} aria-label="Retrying the upload" />`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Large, in danger",
	code: CODE,
	render: () => (
		<Spinner color="danger" size="lg" mix={[spin()]} aria-label="Retrying the upload" />
	),
};
