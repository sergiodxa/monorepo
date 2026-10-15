/**
 * The opening `spacer` example: a toolbar whose brand stays at the start while a spacer
 * pushes its actions to the end.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack, spacer } from "sdxc/u/layout";
import { weight } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The spacer takes the room left in the row, splitting the groups on either side. */
export default {
	title: "Basic example",
	description:
		"Use `spacer()` on an empty element to fill the room left in a flex row, pushing what follows it to the end:",
	align: "stretch",
	render: () => (
		<div mix={[hstack({ gap: 2, align: "center" }), demo.panel()]}>
			<span mix={[weight("semibold")]}>sdxc</span>
			<div mix={[spacer()]} />
			<button type="button" mix={[demo.button()]}>
				Sign in
			</button>
			<button type="button" mix={[demo.button()]}>
				Sign up
			</button>
		</div>
	),
} satisfies UtilityExampleModule;
