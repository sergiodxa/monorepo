/**
 * A `fieldSizing` example on a textarea capped by a maximum block size, so it grows a
 * line at a time and scrolls once the cap is reached.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fieldSizing } from "@sdxc/u/layout";
import { is, maxBs, minBs } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A textarea that grows with its text up to a maximum height. */
export default {
	title: "Growing a textarea",
	description:
		"Combine `fieldSizing()` with `maxBs()` to let a textarea grow with its text until the cap, then scroll. Add a few lines:",
	render: () => (
		<textarea
			value="A textarea that grows with each new line."
			mix={[fieldSizing(), is(80), minBs(12), maxBs(40), demo.field()]}
		/>
	),
} satisfies UtilityExampleModule;
