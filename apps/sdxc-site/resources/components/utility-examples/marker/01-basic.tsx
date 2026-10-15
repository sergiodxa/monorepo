/**
 * The opening `marker` example: a list whose bullets are painted in the brand tone while
 * the text keeps its own color, so the reader sees the marker styled on its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "sdxc/u/color";
import { listStyle } from "sdxc/u/general";
import { vstack } from "sdxc/u/layout";
import { pis } from "sdxc/u/size";
import { marker } from "sdxc/u/state";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Brand-colored bullets on every item, set once on the list. */
export default {
	title: "Basic example",
	description:
		"Wrap utilities in `marker()` to style a list item's bullet or number. Set it on each `<li>`:",
	render: () => (
		<ul mix={[listStyle("disc"), pis(5), vstack({ gap: 1 }), demo.prose()]}>
			<li mix={[marker(fg("brand"))]}>Install the package</li>
			<li mix={[marker(fg("brand"))]}>Import the utilities</li>
			<li mix={[marker(fg("brand"))]}>Mix them into an element</li>
		</ul>
	),
} satisfies UtilityExampleModule;
