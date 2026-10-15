/**
 * The opening `raw` example: an article flowed into two columns, a property no utility
 * covers, written as a plain style object that still composes in a `mix` list.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "sdxc/u/general";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A paragraph set in two columns through a raw style object. */
export default {
	title: "Basic example",
	description:
		"Use `raw({...})` to write declarations no utility covers, like CSS columns, as a mixin that sits beside the others:",
	align: "stretch",
	render: () => (
		<p mix={[raw({ columnCount: 2, columnGap: "2rem" }), demo.prose()]}>
			The ferry left at dawn, and by the time the fog lifted we could see the island: a low green
			line, a lighthouse, and one road climbing from the harbour to the church. Nobody on board had
			been there before. The captain said the bakery opened at eight and closed when the bread ran
			out, which on a Saturday meant before ten, so we walked straight up the hill without stopping
			to look at the boats.
		</p>
	),
} satisfies UtilityExampleModule;
