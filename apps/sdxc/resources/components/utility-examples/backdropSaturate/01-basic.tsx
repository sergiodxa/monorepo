/**
 * The opening `backdropSaturate` example: panes that mute and intensify the photograph
 * behind them, so the reader sees both directions from the untouched `1`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { backdropSaturate } from "@sdxc/u/effects";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Backdrop saturation below and above the untouched `1`. */
export default {
	title: "Basic example",
	description:
		"Use `backdropSaturate(n)` to mute the colors showing through an element below `1`, or intensify them above `1`:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[demo.scene()]}>
				<div mix={[backdropSaturate(0), demo.pane()]}>backdropSaturate(0)</div>
			</div>
			<div mix={[demo.scene()]}>
				<div mix={[backdropSaturate(2.5), demo.pane()]}>backdropSaturate(2.5)</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
