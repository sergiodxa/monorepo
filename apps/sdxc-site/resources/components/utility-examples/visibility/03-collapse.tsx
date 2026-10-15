/**
 * A `visibility` example collapsing a table row, so the reader sees `"collapse"` remove
 * the row's height while the columns keep the widths it gave them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { visibility } from "sdxc/u/effects";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A collapsed table row in a small table. */
export default {
	title: "Collapsing table rows",
	description:
		'Use `visibility("collapse")` on a table row to remove it from the table while its columns keep their widths:',
	render: () => (
		<table mix={[demo.prose()]}>
			<tbody>
				<tr>
					<td>Ada</td>
					<td>Engineer</td>
				</tr>
				<tr mix={[visibility("collapse")]}>
					<td>Grace Brewster Murray</td>
					<td>Admiral</td>
				</tr>
				<tr>
					<td>Alan</td>
					<td>Mathematician</td>
				</tr>
			</tbody>
		</table>
	),
} satisfies UtilityExampleModule;
