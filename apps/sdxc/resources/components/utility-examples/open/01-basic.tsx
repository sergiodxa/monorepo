/**
 * The opening `open` example: a `<details>` disclosure tinted while it is expanded, so the
 * reader clicks its summary and sees the state follow the `open` attribute.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, border } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { cursor } from "@sdxc/u/general";
import { p } from "@sdxc/u/size";
import { open } from "@sdxc/u/state";
import { weight } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A brand tint and border on the disclosure for as long as it is open. */
export default {
	title: "Basic example",
	description:
		"Wrap utilities in `open()` to style a `<details>`, `<dialog>` or popover while it is open. Click the summary:",
	render: () => (
		<details
			mix={[
				border({ color: "neutral.border", width: 1 }),
				open([bg("brand.tint"), border("brand")]),
				rounded("lg"),
				p(4),
				demo.prose(),
			]}
		>
			<summary mix={[cursor("pointer"), weight("semibold")]}>Can I use it without Remix?</summary>
			Yes. The utilities return plain style objects any renderer can apply.
		</details>
	),
} satisfies UtilityExampleModule;
