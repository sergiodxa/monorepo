/**
 * A `where` example spacing every cell of a table from the table itself, with a selector
 * list, so the reader sees one call reach several kinds of descendant at once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { borderEdge } from "sdxc/u/color";
import { p } from "sdxc/u/size";
import { where } from "sdxc/u/state";
import { textAlign } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Padding on every header and data cell, and a rule under the header row. */
export default {
	title: "Selector lists",
	description:
		'Pass a selector list, like `where("th, td", …)`, to reach several kinds of descendant with one call:',
	render: () => (
		<table
			mix={[
				where("th, td", [p(2, 3), textAlign("start")]),
				where("thead th", borderEdge("block-end", { color: "neutral.border", width: 1 })),
				demo.prose(),
			]}
		>
			<thead>
				<tr>
					<th>Package</th>
					<th>Size</th>
				</tr>
			</thead>
			<tbody>
				<tr>
					<td>sdxc/u</td>
					<td>12 kB</td>
				</tr>
				<tr>
					<td>sdxc/ui</td>
					<td>48 kB</td>
				</tr>
			</tbody>
		</table>
	),
} satisfies UtilityExampleModule;
