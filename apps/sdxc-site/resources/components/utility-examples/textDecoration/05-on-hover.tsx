/**
 * A `textDecoration` example combined with a state: navigation links drawn plain that
 * underline only while the pointer is over them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hover } from "sdxc/u/state";
import { textDecoration } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Links with no underline until they are hovered. */
export default {
	title: "Underlining on hover",
	description:
		'Combine `textDecoration("none")` with `hover(textDecoration({ line: "underline", offset: 4 }))` to underline a link only while it is hovered. Hover the links to try it:',
	render: () => (
		<nav mix={[demo.row()]}>
			<a
				href="/pricing"
				mix={[textDecoration("none"), hover(textDecoration({ line: "underline", offset: 4 }))]}
			>
				Pricing
			</a>
			<a
				href="/customers"
				mix={[textDecoration("none"), hover(textDecoration({ line: "underline", offset: 4 }))]}
			>
				Customers
			</a>
			<a
				href="/changelog"
				mix={[textDecoration("none"), hover(textDecoration({ line: "underline", offset: 4 }))]}
			>
				Changelog
			</a>
		</nav>
	),
} satisfies UtilityExampleModule;
