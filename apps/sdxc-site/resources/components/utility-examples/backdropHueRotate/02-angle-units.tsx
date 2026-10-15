/**
 * A `backdropHueRotate` example with angle strings, for turns and radians, which pass through
 * exactly as written.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { backdropHueRotate } from "sdxc/u/effects";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Backdrop hue rotation written in turns and radians. */
export default {
	title: "Using other angle units",
	description: 'Pass a string to use any CSS angle unit, like `backdropHueRotate("0.5turn")`:',
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[demo.scene()]}>
				<div mix={[backdropHueRotate("0.5turn"), demo.pane()]}>backdropHueRotate("0.5turn")</div>
			</div>
			<div mix={[demo.scene()]}>
				<div mix={[backdropHueRotate("-1rad"), demo.pane()]}>backdropHueRotate("-1rad")</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
