/**
 * A `flexWrap` example with `"nowrap"`, keeping every item on one line, where they
 * shrink below the size they asked for to fit.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { flex, flexWrap, gap } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Flex items kept on one line, shrinking to fit. */
export default {
	title: "Don't wrap",
	description: 'Use `flexWrap("nowrap")` to keep every item on one line, shrinking them to fit:',
	render: () => (
		<div mix={[flex(), flexWrap("nowrap"), gap(4), is(96), demo.track()]}>
			<div mix={[is(28), demo.block()]}>01</div>
			<div mix={[is(28), demo.block()]}>02</div>
			<div mix={[is(28), demo.block()]}>03</div>
			<div mix={[is(28), demo.block()]}>04</div>
			<div mix={[is(28), demo.block()]}>05</div>
		</div>
	),
} satisfies UtilityExampleModule;
