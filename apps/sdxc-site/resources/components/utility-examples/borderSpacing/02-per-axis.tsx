/**
 * A `borderSpacing` example with two lengths, which space columns and rows apart
 * independently.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { border } from "sdxc/u/color";
import { rounded } from "sdxc/u/effects";
import { borderSpacing } from "sdxc/u/layout";
import { p } from "sdxc/u/size";
import { where } from "sdxc/u/state";
import { text } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

/** Table cells spaced apart horizontally and vertically by different lengths. */
export default {
	title: "Spacing each axis",
	description:
		'Pass two lengths, like `borderSpacing("1.5rem 0.25rem")`, to space columns apart by the first and rows by the second:',
	render: () => (
		<table
			mix={[
				borderSpacing("1.5rem 0.25rem"),
				text("sm"),
				where("th, td", [
					p(2, 4),
					rounded("md"),
					border({ color: "neutral.border", width: 1, style: "solid" }),
				]),
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
