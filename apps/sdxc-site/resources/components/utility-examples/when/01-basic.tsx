/**
 * The opening `when` example: a zebra-striped list built from an arbitrary
 * `:nth-child` selector, so the reader sees the primitive every state wrapper builds on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg } from "sdxc/u/color";
import { overflow } from "sdxc/u/overflow";
import { is, p } from "sdxc/u/size";
import { when } from "sdxc/u/state";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A tint on every odd row, from a selector no named wrapper covers. */
export default {
	title: "Basic example",
	description:
		"Pass any nested selector starting with `&` to `when()` for a state no named wrapper covers, like odd rows:",
	render: () => (
		<ul mix={[is("100%"), overflow("clip"), demo.frame()]}>
			<li mix={[p(2, 3), when("&:nth-child(odd)", bg("brand.tint")), demo.prose()]}>
				Alice — Admin
			</li>
			<li mix={[p(2, 3), when("&:nth-child(odd)", bg("brand.tint")), demo.prose()]}>
				Bob — Editor
			</li>
			<li mix={[p(2, 3), when("&:nth-child(odd)", bg("brand.tint")), demo.prose()]}>
				Carol — Viewer
			</li>
			<li mix={[p(2, 3), when("&:nth-child(odd)", bg("brand.tint")), demo.prose()]}>
				Dan — Viewer
			</li>
		</ul>
	),
} satisfies UtilityExampleModule;
