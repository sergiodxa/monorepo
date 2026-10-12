/**
 * The opening `cursor` example: a row of boxes each setting a different pointer, so the
 * reader hovers them one by one to see the shape each keyword asks for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { cursor } from "@sdxc/u/general";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Boxes showing six cursor keywords on hover. */
export default {
	title: "Basic example",
	description:
		'Use `cursor(value)`, like `cursor("pointer")` or `cursor("wait")`, to set the pointer shown over an element. Hover each box to see it:',
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[cursor("pointer"), demo.block()]}>cursor("pointer")</div>
			<div mix={[cursor("progress"), demo.block()]}>cursor("progress")</div>
			<div mix={[cursor("text"), demo.block()]}>cursor("text")</div>
			<div mix={[cursor("move"), demo.block()]}>cursor("move")</div>
			<div mix={[cursor("help"), demo.block()]}>cursor("help")</div>
			<div mix={[cursor("crosshair"), demo.block()]}>cursor("crosshair")</div>
		</div>
	),
} satisfies UtilityExampleModule;
