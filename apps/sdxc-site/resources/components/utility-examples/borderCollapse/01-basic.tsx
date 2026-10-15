/**
 * The opening `borderCollapse` example: a bordered table whose cell borders merge into
 * single lines, the way most data tables are drawn.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { border } from "sdxc/u/color";
import { borderCollapse } from "sdxc/u/layout";
import { p } from "sdxc/u/size";
import { where } from "sdxc/u/state";
import { text } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

/** A table whose adjacent cell borders merge into one line. */
export default {
	title: "Basic example",
	description:
		"Use `borderCollapse()` to merge the borders of adjacent table cells into single lines:",
	render: () => (
		<table
			mix={[
				borderCollapse(),
				text("sm"),
				where("th, td", [p(2, 4), border({ color: "neutral.border", width: 1, style: "solid" })]),
			]}
		>
			<thead>
				<tr>
					<th>Package</th>
					<th>Subpath</th>
				</tr>
			</thead>
			<tbody>
				<tr>
					<td>sdxc/u</td>
					<td>layout</td>
				</tr>
				<tr>
					<td>sdxc/u</td>
					<td>color</td>
				</tr>
			</tbody>
		</table>
	),
} satisfies UtilityExampleModule;
