/**
 * The opening `hstack` example: three items in a row, with the striped container
 * showing the gap the stack puts between them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack } from "@sdxc/u/layout";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A row of items spaced by one step of the spacing scale. */
export default {
	title: "Basic example",
	description:
		"Use `hstack()` to lay children out in a row, with the `gap` option setting the space between them:",
	render: () => (
		<div mix={[hstack({ gap: 4 }), demo.stripes()]}>
			<div mix={[demo.block()]}>01</div>
			<div mix={[demo.block()]}>02</div>
			<div mix={[demo.block()]}>03</div>
		</div>
	),
} satisfies UtilityExampleModule;
