/**
 * The opening `visibility` example: three boxes with the middle one hidden, so the
 * reader sees a hidden element keep the space it takes in the layout.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { visibility } from "@sdxc/u/effects";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A hidden box keeping its place between two visible ones. */
export default {
	title: "Basic example",
	description:
		'Use `visibility("hidden")` to hide an element while it keeps its place in the layout:',
	render: () => (
		<div mix={[demo.row(), demo.track()]}>
			<div mix={[demo.block()]}>01</div>
			<div mix={[visibility("hidden"), demo.block()]}>02</div>
			<div mix={[demo.block()]}>03</div>
		</div>
	),
} satisfies UtilityExampleModule;
