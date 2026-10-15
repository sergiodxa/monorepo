/**
 * A `calc` example reading a custom property: a sidebar takes its width from a variable
 * and the main column takes whatever the same variable leaves of the row.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as u from "sdxc/u/general";
import { hstack } from "sdxc/u/layout";
import { is } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Two columns sharing one width variable, one of them through a subtraction. */
export default {
	title: "With custom properties",
	description:
		"Combine `calc()` with `u.var()` so one custom property drives several sizes, like a main column that fills what a sidebar leaves:",
	align: "stretch",
	render: () => (
		<div mix={[u.vars({ sidebar: "10rem" }), hstack(), demo.track()]}>
			<aside mix={[is(u.var("sidebar")), demo.block()]}>sidebar</aside>
			<main mix={[is(u.calc(`100% - ${u.var("sidebar")}`)), demo.block()]}>main</main>
		</div>
	),
} satisfies UtilityExampleModule;
