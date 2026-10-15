/**
 * The opening `vstack` example: three items in a column, with the striped container
 * showing the gap the stack puts between them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "sdxc/u/layout";
import { is } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A column of items spaced by one step of the spacing scale. */
export default {
	title: "Basic example",
	description:
		"Use `vstack()` to lay children out in a column, with the `gap` option setting the space between them:",
	render: () => (
		<div mix={[vstack({ gap: 4 }), is(48), demo.stripes()]}>
			<div mix={[demo.block()]}>01</div>
			<div mix={[demo.block()]}>02</div>
			<div mix={[demo.block()]}>03</div>
		</div>
	),
} satisfies UtilityExampleModule;
