/**
 * The opening `backdropGrayscale` example: panes that partly and fully desaturate the
 * photograph behind them, so the reader sees what the amount controls.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { backdropGrayscale } from "@sdxc/u/effects";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Partial and full grayscale behind a see-through pane. */
export default {
	title: "Basic example",
	description:
		"Use `backdropGrayscale(n)` to desaturate what shows through an element, where `backdropGrayscale()` with no argument is fully grey:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[demo.scene()]}>
				<div mix={[backdropGrayscale(0.5), demo.pane()]}>backdropGrayscale(0.5)</div>
			</div>
			<div mix={[demo.scene()]}>
				<div mix={[backdropGrayscale(), demo.pane()]}>backdropGrayscale()</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
