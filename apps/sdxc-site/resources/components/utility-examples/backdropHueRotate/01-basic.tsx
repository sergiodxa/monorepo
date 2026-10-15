/**
 * The opening `backdropHueRotate` example: panes that turn the photograph behind them
 * around the color wheel, so the reader sees the hue move while lightness holds.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { backdropHueRotate } from "sdxc/u/effects";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Backdrop hue rotation in degrees. */
export default {
	title: "Basic example",
	description:
		"Use `backdropHueRotate(n)` to rotate the colors showing through an element by `n` degrees:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[demo.scene()]}>
				<div mix={[backdropHueRotate(90), demo.pane()]}>backdropHueRotate(90)</div>
			</div>
			<div mix={[demo.scene()]}>
				<div mix={[backdropHueRotate(180), demo.pane()]}>backdropHueRotate(180)</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
