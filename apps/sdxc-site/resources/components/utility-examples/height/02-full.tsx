/**
 * A `height` example filling its parent: a box at `"full"` beside one at half, inside a
 * parent with a height of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack } from "sdxc/u/layout";
import { height, p, width } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** `"full"` fills the parent's height. */
export default {
	title: "Filling the parent",
	description:
		'Use `height("full")` to fill the height of a parent that sets one, or pass any CSS length as a string, like `height("50%")`:',
	render: () => (
		<div mix={[hstack({ gap: 4, align: "start" }), height(48), p(4), demo.track()]}>
			<div mix={[height("full"), width(32), demo.cell()]}>height("full")</div>
			<div mix={[height("50%"), width(32), demo.cell()]}>height("50%")</div>
		</div>
	),
} satisfies UtilityExampleModule;
