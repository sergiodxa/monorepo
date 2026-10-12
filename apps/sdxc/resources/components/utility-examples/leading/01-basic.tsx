/**
 * The opening `leading` example: one paragraph set three times at named steps of the
 * leading scale, side by side, so the space between lines is what the reader compares.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { gap, grid, gridTemplate } from "@sdxc/u/layout";
import { leading } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** One paragraph at the tight, normal and loose steps of the leading scale. */
export default {
	title: "Basic example",
	description:
		'Use `leading(name)` with a step of the leading scale, like `leading("tight")` or `leading("loose")`, to set the line height of an element:',
	align: "stretch",
	render: () => (
		<div mix={[grid(), gridTemplate({ columns: "repeat(3, 1fr)" }), gap(6)]}>
			<div>
				<p mix={[demo.caption()]}>leading("tight")</p>
				<p mix={[leading("tight")]}>
					The ferry left at dawn, and by the time the fog lifted we could see the island: a low
					green line, a lighthouse, and one road climbing from the harbour to the church.
				</p>
			</div>
			<div>
				<p mix={[demo.caption()]}>leading("normal")</p>
				<p mix={[leading("normal")]}>
					The ferry left at dawn, and by the time the fog lifted we could see the island: a low
					green line, a lighthouse, and one road climbing from the harbour to the church.
				</p>
			</div>
			<div>
				<p mix={[demo.caption()]}>leading("loose")</p>
				<p mix={[leading("loose")]}>
					The ferry left at dawn, and by the time the fog lifted we could see the island: a low
					green line, a lighthouse, and one road climbing from the harbour to the church.
				</p>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
