/**
 * The opening `backdropInvert` example: panes that partly and fully invert the
 * photograph behind them, so the reader sees the amount the argument controls.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { backdropInvert } from "@sdxc/u/effects";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Partial and full inversion behind a see-through pane. */
export default {
	title: "Basic example",
	description:
		"Use `backdropInvert(n)` to invert the colors showing through an element, where `backdropInvert()` with no argument inverts them fully:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[demo.scene()]}>
				<div mix={[backdropInvert(0.25), demo.pane()]}>backdropInvert(0.25)</div>
			</div>
			<div mix={[demo.scene()]}>
				<div mix={[backdropInvert(), demo.pane()]}>backdropInvert()</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
