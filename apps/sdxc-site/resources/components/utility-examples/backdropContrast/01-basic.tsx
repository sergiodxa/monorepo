/**
 * The opening `backdropContrast` example: panes that flatten and sharpen the contrast of
 * the photograph behind them, so the reader sees both directions of the scale.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { backdropContrast } from "@sdxc/u/effects";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Backdrop contrast below and above the untouched `1`. */
export default {
	title: "Basic example",
	description:
		"Use `backdropContrast(n)` to flatten what shows through an element toward grey below `1`, or push it apart above `1`:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[demo.scene()]}>
				<div mix={[backdropContrast(0.4), demo.pane()]}>backdropContrast(0.4)</div>
			</div>
			<div mix={[demo.scene()]}>
				<div mix={[backdropContrast(2), demo.pane()]}>backdropContrast(2)</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
