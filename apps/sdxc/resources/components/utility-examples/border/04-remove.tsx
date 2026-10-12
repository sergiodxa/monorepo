/**
 * A `border` example removing the border a browser draws on a native button, so a reader
 * sees `border("none")` clear the width, the style and the color at once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { border } from "@sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A native button with and without its default border. */
export default {
	title: "Removing a border",
	description:
		"Pass `none` to remove a border entirely, such as the one a browser draws around a native button:",
	render: () => (
		<div mix={[demo.row()]}>
			<button type="button" mix={[demo.swatch()]}>
				Default button
			</button>
			<button type="button" mix={[border("none"), demo.swatch()]}>
				border("none")
			</button>
		</div>
	),
} satisfies UtilityExampleModule;
