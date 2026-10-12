/**
 * The opening `borderSpacing` example: a table whose cells sit apart by one length on both
 * axes, each cell keeping its own border.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { border } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { borderSpacing } from "@sdxc/u/layout";
import { p } from "@sdxc/u/size";
import { where } from "@sdxc/u/state";
import { text } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

/** Table cells spaced apart on both axes by one length. */
export default {
	title: "Basic example",
	description:
		"Use `borderSpacing(length)` to set the space between the borders of adjacent table cells:",
	render: () => (
		<table
			mix={[
				borderSpacing("0.5rem"),
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
					<td>@sdxc/u</td>
					<td>layout</td>
				</tr>
				<tr>
					<td>@sdxc/u</td>
					<td>color</td>
				</tr>
			</tbody>
		</table>
	),
} satisfies UtilityExampleModule;
