/**
 * A `data` example switching layout from an attribute, the way a component exposes its
 * orientation, so the reader sees the same markup laid out two ways.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { flexCol, hstack } from "@sdxc/u/layout";
import { data } from "@sdxc/u/state";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A row by default, and a column when `data-orientation` is `vertical`. */
export default {
	title: "Switching layout",
	description:
		'Any utility works inside `data()`, like `flexCol()` to stack a toolbar marked `data-orientation="vertical"`:',
	render: () => (
		<div mix={[demo.row()]}>
			<div
				data-orientation="horizontal"
				mix={[hstack({ gap: 2 }), data("orientation", "vertical", flexCol())]}
			>
				<div mix={[demo.block()]}>1</div>
				<div mix={[demo.block()]}>2</div>
				<div mix={[demo.block()]}>3</div>
			</div>
			<div
				data-orientation="vertical"
				mix={[hstack({ gap: 2 }), data("orientation", "vertical", flexCol())]}
			>
				<div mix={[demo.block()]}>1</div>
				<div mix={[demo.block()]}>2</div>
				<div mix={[demo.block()]}>3</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
