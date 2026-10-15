/**
 * The opening `placeholderShown` example: a field that sinks into the page while it is
 * empty and lifts out with a brand border once the reader types into it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, border } from "sdxc/u/color";
import { transition } from "sdxc/u/effects";
import { placeholderShown } from "sdxc/u/state";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A transparent background and neutral border for as long as the placeholder shows. */
export default {
	title: "Basic example",
	description:
		"Wrap utilities in `placeholderShown()` to style a field while it is empty. Type in the field to see it change:",
	render: () => (
		<input
			type="text"
			placeholder="Coupon code"
			mix={[
				border("brand.strong"),
				placeholderShown([bg("transparent"), border("neutral.border")]),
				transition("background-color, border-color"),
				demo.input(),
			]}
		/>
	),
} satisfies UtilityExampleModule;
