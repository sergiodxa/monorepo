/**
 * Live example for a `Spinner` composed with `spin()`, which supplies the rotation the
 * component's own styling leaves out. The loop is plain keyframes, so it runs from the
 * server markup and the example needs no island of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Spinner } from "@sdxc/ui";
import { spin } from "@sdxc/ui/animations";

/** The source the page shows, matching the markup below. */
const CODE = `<Spinner mix={[spin()]} aria-label="Loading your projects" />`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Spinning",
	code: CODE,
	render: () => <Spinner mix={[spin()]} aria-label="Loading your projects" />,
};
