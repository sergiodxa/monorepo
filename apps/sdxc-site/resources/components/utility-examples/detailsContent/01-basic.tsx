/**
 * The opening `detailsContent` example: a disclosure whose expanded region, everything
 * after its `<summary>`, gets its own rule and indent, so the reader sees that region.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { borderEdge } from "sdxc/u/color";
import { cursor } from "sdxc/u/general";
import { mbs, pis } from "sdxc/u/size";
import { detailsContent } from "sdxc/u/state";
import { weight } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A brand rule and indent beside the details' content, with no wrapper element. */
export default {
	title: "Basic example",
	description:
		"Wrap utilities in `detailsContent()` to style the part of a `<details>` that opens. Click the summary:",
	render: () => (
		<details
			mix={[
				detailsContent([borderEdge("inline-start", { color: "brand", width: 2 }), pis(3), mbs(2)]),
				demo.prose(),
			]}
		>
			<summary mix={[cursor("pointer"), weight("semibold")]}>What does it cost?</summary>
			Every package is MIT licensed and free to use.
		</details>
	),
} satisfies UtilityExampleModule;
