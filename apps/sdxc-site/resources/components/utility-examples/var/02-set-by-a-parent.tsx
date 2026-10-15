/**
 * A `var` example where an ancestor sets the property: the same sidebar markup twice, the
 * second under a parent that widens it without touching the sidebar itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as u from "@sdxc/u/general";
import { grow, hstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** One layout with its fallback width and with a width a parent sets. */
export default {
	title: "Setting it from a parent",
	description:
		"Set the property on an ancestor with `u.vars()` and every `u.var()` below it picks the value up, so one layout adapts by context:",
	align: "stretch",
	render: () => (
		<div mix={[demo.stack()]}>
			<div mix={[hstack({ gap: 4 })]}>
				<aside mix={[is(u.var("sidebar-width", "12rem")), demo.block()]}>12rem</aside>
				<main mix={[grow(), demo.block()]}>main</main>
			</div>
			<div mix={[u.vars({ "sidebar-width": "20rem" }), hstack({ gap: 4 })]}>
				<aside mix={[is(u.var("sidebar-width", "12rem")), demo.block()]}>20rem</aside>
				<main mix={[grow(), demo.block()]}>main</main>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
