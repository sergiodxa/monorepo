/**
 * A `textAlign` example justifying a paragraph, which stretches the spaces of each line
 * so both edges of the column are straight.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { maxIs } from "@sdxc/u/size";
import { textAlign } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A paragraph justified to both edges of its column. */
export default {
	title: "Justifying text",
	description:
		'Use `textAlign("justify")` to stretch each line so the text meets both edges of its box:',
	render: () => (
		<div mix={[maxIs(96)]}>
			<p mix={[demo.caption()]}>textAlign("justify")</p>
			<p mix={[textAlign("justify")]}>
				The ferry left at dawn, and by the time the fog lifted we could see the island: a low green
				line, a lighthouse, and one road climbing from the harbour to the church. Nobody on board
				had been there before, and nobody said a word until we docked.
			</p>
		</div>
	),
} satisfies UtilityExampleModule;
