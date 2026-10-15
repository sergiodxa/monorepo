/**
 * The opening `var` example: a sidebar sized from a custom property that nothing has set,
 * so the fallback written beside the name is the width it takes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as u from "sdxc/u/general";
import { grow, hstack } from "sdxc/u/layout";
import { is } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A sidebar whose width reads a custom property with a fallback. */
export default {
	title: "Basic example",
	description:
		"Use `u.var(name, fallback)` to read a custom property in any utility that takes a CSS value; it is written `u.var` because `var` is a reserved word:",
	align: "stretch",
	render: () => (
		<div mix={[hstack({ gap: 4 })]}>
			<aside mix={[is(u.var("sidebar-width", "12rem")), demo.block()]}>sidebar</aside>
			<main mix={[grow(), demo.block()]}>main</main>
		</div>
	),
} satisfies UtilityExampleModule;
