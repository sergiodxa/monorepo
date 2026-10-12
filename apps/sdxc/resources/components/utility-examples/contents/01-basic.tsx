/**
 * The only `contents` example: a wrapper whose own box disappears, so its two children
 * join the flex row around it as if the wrapper were not there.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { contents, flex, gap } from "@sdxc/u/layout";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A wrapper removed from layout so its children become flex items of its parent. */
export default {
	title: "Basic example",
	description:
		"Use `contents()` to remove an element's own box, so its children lay out as children of its parent:",
	render: () => (
		<div mix={[flex(), gap(4)]}>
			<div mix={[demo.block()]}>01</div>
			<div mix={[contents(), demo.stripes()]}>
				<div mix={[demo.block()]}>02</div>
				<div mix={[demo.block()]}>03</div>
			</div>
			<div mix={[demo.block()]}>04</div>
		</div>
	),
} satisfies UtilityExampleModule;
