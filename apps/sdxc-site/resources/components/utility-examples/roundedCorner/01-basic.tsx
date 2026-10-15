/**
 * The opening `roundedCorner` example: one box per logical corner, so the reader sees
 * which corner each start/end pair names in a left-to-right page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { roundedCorner } from "sdxc/u/effects";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Each logical corner rounded on its own. */
export default {
	title: "Basic example",
	description:
		'Use `roundedCorner(corner, step)` to round one corner, named by its block and inline side, like `"start-start"` for the top left in English:',
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[roundedCorner("start-start", "xl"), demo.shape()]}>start-start</div>
			<div mix={[roundedCorner("start-end", "xl"), demo.shape()]}>start-end</div>
			<div mix={[roundedCorner("end-start", "xl"), demo.shape()]}>end-start</div>
			<div mix={[roundedCorner("end-end", "xl"), demo.shape()]}>end-end</div>
		</div>
	),
} satisfies UtilityExampleModule;
