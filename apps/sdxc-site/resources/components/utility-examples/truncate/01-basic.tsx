/**
 * The opening `truncate` example: a sentence cut to one line with an ellipsis once it
 * reaches the edge of a narrow card.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { maxIs } from "sdxc/u/size";
import { truncate } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** One line of text ending in an ellipsis where it meets the card's edge. */
export default {
	title: "Basic example",
	description:
		"Use `truncate()` to keep text on one line and end it in an ellipsis where it overflows:",
	render: () => (
		<div mix={[maxIs(64), demo.panel()]}>
			<p mix={[truncate()]}>The longest train in the world stretched over seven kilometres.</p>
		</div>
	),
} satisfies UtilityExampleModule;
