/**
 * A `borderCollapse` example with `"separate"`, where every cell keeps its own border, so
 * a reader sees the doubled lines collapsing removes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { border } from "sdxc/u/color";
import { borderCollapse, borderSpacing } from "sdxc/u/layout";
import { p } from "sdxc/u/size";
import { where } from "sdxc/u/state";
import { text } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

/** A table whose cells each keep their own border. */
export default {
	title: "Separating borders",
	description:
		'Use `borderCollapse("separate")` to give every cell its own border, spaced apart by `borderSpacing()`:',
	render: () => (
		<table
			mix={[
				borderCollapse("separate"),
				borderSpacing("0.25rem"),
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
