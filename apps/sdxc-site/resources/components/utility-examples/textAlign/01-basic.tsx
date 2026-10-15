/**
 * The opening `textAlign` example: one paragraph aligned to the start, the centre and the
 * end of its box, each labelled with the call that set it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { maxIs } from "sdxc/u/size";
import { textAlign } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A paragraph aligned to the start, the centre and the end. */
export default {
	title: "Basic example",
	description:
		'Use `textAlign("start")`, `textAlign("center")` or `textAlign("end")` to align the text of an element:',
	render: () => (
		<div mix={[maxIs(96), demo.stack()]}>
			<div>
				<p mix={[demo.caption()]}>textAlign("start")</p>
				<p mix={[textAlign("start")]}>
					The ferry left at dawn, and by the time the fog lifted we could see the island.
				</p>
			</div>
			<div>
				<p mix={[demo.caption()]}>textAlign("center")</p>
				<p mix={[textAlign("center")]}>
					The ferry left at dawn, and by the time the fog lifted we could see the island.
				</p>
			</div>
			<div>
				<p mix={[demo.caption()]}>textAlign("end")</p>
				<p mix={[textAlign("end")]}>
					The ferry left at dawn, and by the time the fog lifted we could see the island.
				</p>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
