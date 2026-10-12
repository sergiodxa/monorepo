/**
 * The opening `justify` example: three items spread to the two ends and the middle of
 * their row, with the striped container showing the room between them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { flex, justify } from "@sdxc/u/layout";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Space between puts equal room between items and none at the ends. */
export default {
	title: "Basic example",
	description:
		'Use `justify("between")` to spread items along the main axis with equal room between each one:',
	align: "stretch",
	render: () => (
		<div mix={[flex(), justify("between"), demo.stripes()]}>
			<div mix={[demo.block()]}>01</div>
			<div mix={[demo.block()]}>02</div>
			<div mix={[demo.block()]}>03</div>
		</div>
	),
} satisfies UtilityExampleModule;
