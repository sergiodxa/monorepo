/**
 * The opening `listStyle` example: one list drawn with no markers, with bullets and with
 * numbers, each labelled with the call that set its marker.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { listStyle } from "@sdxc/u/general";
import { gap, grid, gridTemplate } from "@sdxc/u/layout";
import { pis } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A packing list with no markers, bullets and numbers. */
export default {
	title: "Basic example",
	description:
		'Use `listStyle("disc")` or `listStyle("decimal")` to draw bullets or numbers beside list items, and `listStyle()` to remove them:',
	render: () => (
		<div mix={[grid(), gridTemplate({ columns: "repeat(3, auto)" }), gap(10)]}>
			<div>
				<p mix={[demo.caption()]}>listStyle()</p>
				<ul mix={[listStyle()]}>
					<li>Passport</li>
					<li>Charger</li>
					<li>Rain jacket</li>
				</ul>
			</div>
			<div>
				<p mix={[demo.caption()]}>listStyle("disc")</p>
				<ul mix={[listStyle("disc"), pis(5)]}>
					<li>Passport</li>
					<li>Charger</li>
					<li>Rain jacket</li>
				</ul>
			</div>
			<div>
				<p mix={[demo.caption()]}>listStyle("decimal")</p>
				<ol mix={[listStyle("decimal"), pis(5)]}>
					<li>Passport</li>
					<li>Charger</li>
					<li>Rain jacket</li>
				</ol>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
