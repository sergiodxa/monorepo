/**
 * The opening `backdropOpacity` example: an inverting pane at three opacities, so the
 * reader sees the amount set how strongly the other backdrop filters show.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { backdropInvert, backdropOpacity } from "@sdxc/u/effects";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Backdrop opacity fading an inverted backdrop. */
export default {
	title: "Basic example",
	description:
		"Use `backdropOpacity(n)` with another backdrop filter to set how strongly the filtered backdrop shows, from `0` to `1`:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[demo.scene()]}>
				<div mix={[backdropInvert(), backdropOpacity(0.25), demo.pane()]}>
					backdropOpacity(0.25)
				</div>
			</div>
			<div mix={[demo.scene()]}>
				<div mix={[backdropInvert(), backdropOpacity(0.5), demo.pane()]}>backdropOpacity(0.5)</div>
			</div>
			<div mix={[demo.scene()]}>
				<div mix={[backdropInvert(), backdropOpacity(0.75), demo.pane()]}>
					backdropOpacity(0.75)
				</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
