/**
 * A `gap` example in a wrapping flex row of tags, where the same gap spaces items along
 * a line and the lines themselves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { listStyle } from "@sdxc/u/general";
import { flex, flexWrap, gap } from "@sdxc/u/layout";
import { is, m, p } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A wrapping row of tags spaced apart by one gap. */
export default {
	title: "Spacing a wrapping row",
	description:
		"`gap()` works in flex containers too, spacing items along each line and the lines that wrap:",
	render: () => (
		<ul mix={[flex(), flexWrap(), gap(2), is(80), m(0), p(0), listStyle("none")]}>
			<li mix={[demo.block()]}>layout</li>
			<li mix={[demo.block()]}>size</li>
			<li mix={[demo.block()]}>color</li>
			<li mix={[demo.block()]}>typography</li>
			<li mix={[demo.block()]}>effects</li>
			<li mix={[demo.block()]}>overflow</li>
		</ul>
	),
} satisfies UtilityExampleModule;
