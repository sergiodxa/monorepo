/**
 * A `fontSize` example paired with its own line height: the call sets only the size, so a
 * paragraph keeps whatever leading the caller writes beside it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { maxIs } from "sdxc/u/size";
import { fontSize, leading } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** One size of text with a tight and a loose line height, set apart from the size. */
export default {
	title: "Setting the line height",
	description:
		"`fontSize()` touches only the font size, so pair it with `leading()` to choose the line height yourself, or reach for `text()` to set both:",
	render: () => (
		<div mix={[maxIs(96), demo.stack()]}>
			<div>
				<p mix={[demo.caption()]}>fontSize("lg"), leading("tight")</p>
				<p mix={[fontSize("lg"), leading("tight")]}>
					The ferry left at dawn, and by the time the fog lifted we could see the island: a low
					green line, a lighthouse, and one road climbing from the harbour to the church.
				</p>
			</div>
			<div>
				<p mix={[demo.caption()]}>fontSize("lg"), leading("loose")</p>
				<p mix={[fontSize("lg"), leading("loose")]}>
					The ferry left at dawn, and by the time the fog lifted we could see the island: a low
					green line, a lighthouse, and one road climbing from the harbour to the church.
				</p>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
