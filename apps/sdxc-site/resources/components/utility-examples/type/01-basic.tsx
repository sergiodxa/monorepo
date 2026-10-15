/**
 * The opening `type` example: a heading inside serif copy, set back to the sans family at
 * a step of the text scale by one call.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { font, type, weight } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A sans heading over serif body copy, from one call setting family, size and leading. */
export default {
	title: "Basic example",
	description:
		'Use `type(name)` to set the sans family together with a step\'s font size and line height, like `type("2xl")` for a heading:',
	render: () => (
		<article mix={[font("serif"), demo.panel()]}>
			<h3 mix={[type("2xl"), weight("bold")]}>A field guide to winter birds</h3>
			<p>
				Chickadees stay put all winter, caching seeds in bark and moss and remembering thousands of
				hiding places well into spring.
			</p>
		</article>
	),
} satisfies UtilityExampleModule;
