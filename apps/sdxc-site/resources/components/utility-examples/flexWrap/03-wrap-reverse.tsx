/**
 * A `flexWrap` example with `"wrap-reverse"`, which wraps the overflowing items onto a
 * line above the first instead of below it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { flex, flexWrap, gap } from "sdxc/u/layout";
import { is } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Flex items wrapping onto lines stacked in reverse. */
export default {
	title: "Wrap in reverse",
	description:
		'Use `flexWrap("wrap-reverse")` to wrap items onto new lines stacked in the opposite direction:',
	render: () => (
		<div mix={[flex(), flexWrap("wrap-reverse"), gap(4), is(96), demo.track()]}>
			<div mix={[is(28), demo.block()]}>01</div>
			<div mix={[is(28), demo.block()]}>02</div>
			<div mix={[is(28), demo.block()]}>03</div>
			<div mix={[is(28), demo.block()]}>04</div>
			<div mix={[is(28), demo.block()]}>05</div>
		</div>
	),
} satisfies UtilityExampleModule;
