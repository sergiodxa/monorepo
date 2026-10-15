/**
 * The `hidden` example: three items with the middle one removed, so its neighbours close
 * the gap it would have left.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hidden } from "sdxc/u/layout";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A hidden element takes no room, so the row closes up around it. */
export default {
	title: "Basic example",
	description:
		"Use `hidden()` to remove an element from the page entirely, as if it was never there:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[demo.block()]}>01</div>
			<div mix={[hidden(), demo.block()]}>02</div>
			<div mix={[demo.block()]}>03</div>
		</div>
	),
} satisfies UtilityExampleModule;
