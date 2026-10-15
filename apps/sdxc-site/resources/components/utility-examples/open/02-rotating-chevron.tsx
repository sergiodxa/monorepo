/**
 * An `open` example reaching into the disclosure with `where()` to turn its chevron, so
 * the reader sees an open state style a descendant rather than the element itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "sdxc/u/color";
import { transition } from "sdxc/u/effects";
import { cursor, listStyle } from "sdxc/u/general";
import { hstack, inlineBlock } from "sdxc/u/layout";
import { open, where } from "sdxc/u/state";
import { rotate } from "sdxc/u/transform";
import { weight } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The chevron turns a quarter while its `<details>` is open. */
export default {
	title: "Styling the contents",
	description:
		"Nest `where()` inside `open()` to change a descendant, like turning a chevron. Click the summary:",
	render: () => (
		<details mix={[open(where("[data-chevron]", rotate(90))), demo.panel()]}>
			<summary
				mix={[
					hstack({ gap: 2, align: "center" }),
					listStyle("none"),
					cursor("pointer"),
					weight("semibold"),
				]}
			>
				<span data-chevron mix={[inlineBlock(), fg("brand"), transition("transform")]}>
					▸
				</span>
				Shipping and returns
			</summary>
			Orders ship within two business days.
		</details>
	),
} satisfies UtilityExampleModule;
