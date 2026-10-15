/**
 * A `width` example sized against its container: the full width, and fractions of it
 * written as CSS percentages.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { width } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Width relative to the container. */
export default {
	title: "Percentages",
	description:
		'Use `width("full")` to fill the container\'s width, or pass any CSS length as a string, like `width("50%")`:',
	align: "stretch",
	render: () => (
		<div mix={[demo.stack()]}>
			<div mix={[width("full"), demo.block()]}>width("full")</div>
			<div mix={[width("75%"), demo.block()]}>width("75%")</div>
			<div mix={[width("50%"), demo.block()]}>width("50%")</div>
			<div mix={[width("25%"), demo.block()]}>width("25%")</div>
		</div>
	),
} satisfies UtilityExampleModule;
