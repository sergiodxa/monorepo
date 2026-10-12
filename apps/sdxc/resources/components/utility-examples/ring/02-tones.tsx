/**
 * A `ring` example in the status tones, so a destructive or a confirming action carries
 * a focus ring in its own tone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ring } from "@sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Focus rings in the success and danger tones. */
export default {
	title: "Tones",
	description:
		"Pass a tone, like `danger`, to color the ring. Tab through the buttons to see each one:",
	render: () => (
		<div mix={[demo.row()]}>
			<button type="button" mix={[ring("brand"), demo.block()]}>
				ring("brand")
			</button>
			<button type="button" mix={[ring("success"), demo.block()]}>
				ring("success")
			</button>
			<button type="button" mix={[ring("danger"), demo.block()]}>
				ring("danger")
			</button>
		</div>
	),
} satisfies UtilityExampleModule;
