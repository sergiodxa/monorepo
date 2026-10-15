/**
 * An `is` example sized against its container: the full width, and fractions of it
 * written as CSS percentages.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Inline size relative to the container. */
export default {
	title: "Percentages",
	description:
		'Use `is("full")` to fill the container\'s inline size, or pass any CSS length as a string, like `is("50%")`:',
	align: "stretch",
	render: () => (
		<div mix={[demo.stack()]}>
			<div mix={[is("full"), demo.block()]}>is("full")</div>
			<div mix={[is("75%"), demo.block()]}>is("75%")</div>
			<div mix={[is("50%"), demo.block()]}>is("50%")</div>
			<div mix={[is("25%"), demo.block()]}>is("25%")</div>
		</div>
	),
} satisfies UtilityExampleModule;
