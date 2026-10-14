/**
 * The opening `borderEdge` example: a heading underlined by a border on its block-end
 * edge alone, the divider a section title commonly carries.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { borderEdge } from "@sdxc/u/color";
import { pbe } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A heading with a brand rule along its block-end edge. */
export default {
	title: "Basic example",
	description:
		"Use `borderEdge` with an edge and an object to draw a border on one side of an element only:",
	render: () => (
		<h3 mix={[borderEdge("block-end", { color: "brand.strong", width: 2 }), pbe(2), demo.prose()]}>
			Release notes
		</h3>
	),
} satisfies UtilityExampleModule;
