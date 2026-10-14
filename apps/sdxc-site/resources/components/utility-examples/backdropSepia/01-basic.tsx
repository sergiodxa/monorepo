/**
 * The opening `backdropSepia` example: panes that partly and fully tone the photograph
 * behind them, so the reader sees how the amount moves it toward warm brown.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { backdropSepia } from "@sdxc/u/effects";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Partial and full sepia behind a see-through pane. */
export default {
	title: "Basic example",
	description:
		"Use `backdropSepia(n)` to tone what shows through an element toward warm brown, where `backdropSepia()` with no argument converts it fully:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[demo.scene()]}>
				<div mix={[backdropSepia(0.5), demo.pane()]}>backdropSepia(0.5)</div>
			</div>
			<div mix={[demo.scene()]}>
				<div mix={[backdropSepia(), demo.pane()]}>backdropSepia()</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
