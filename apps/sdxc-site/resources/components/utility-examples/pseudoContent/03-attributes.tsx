/**
 * A `pseudoContent` example reading an attribute: each link prints the address it points
 * to after its text, the way a printed page keeps links usable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "sdxc/u/color";
import { pseudoContent } from "sdxc/u/general";
import { after } from "sdxc/u/state";
import { text } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A link followed by its own href, read with `attr()`. */
export default {
	title: "Reading attributes",
	description:
		'The value can use CSS functions like `attr()`, so `pseudoContent(\'" (" attr(href) ")"\')` prints the address a link points to:',
	render: () => (
		<p mix={[demo.prose()]}>
			Tickets are on sale at the{" "}
			<a
				href="https://example.com/tickets"
				mix={[after([pseudoContent('" (" attr(href) ")"'), text("sm"), fg("neutral.muted")])]}
			>
				box office
			</a>
			.
		</p>
	),
} satisfies UtilityExampleModule;
