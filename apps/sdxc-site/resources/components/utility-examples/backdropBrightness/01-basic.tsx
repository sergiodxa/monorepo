/**
 * The opening `backdropBrightness` example: panes that darken and brighten the
 * photograph behind them, so the reader sees which side of `1` does what.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { backdropBrightness } from "sdxc/u/effects";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Backdrop brightness below and above the untouched `1`. */
export default {
	title: "Basic example",
	description:
		"Use `backdropBrightness(n)` to darken what shows through an element below `1`, or brighten it above `1`:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[demo.scene()]}>
				<div mix={[backdropBrightness(0.5), demo.pane()]}>backdropBrightness(0.5)</div>
			</div>
			<div mix={[demo.scene()]}>
				<div mix={[backdropBrightness(1.5), demo.pane()]}>backdropBrightness(1.5)</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
