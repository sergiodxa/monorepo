/**
 * The opening `pseudoContent` example: an arrow added after each external link by its
 * styles, so the markup carries only the link text.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { pseudoContent } from "@sdxc/u/general";
import { after } from "@sdxc/u/state";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** External links marked with an arrow drawn by a pseudo-element. */
export default {
	title: "Basic example",
	description:
		"Use `pseudoContent(value)` inside `before()` or `after()` to set the text a pseudo-element draws; the value is CSS, so a string keeps its quotes:",
	render: () => (
		<p mix={[demo.prose()]}>
			Read the{" "}
			<a href="https://example.com/releases" mix={[fg("brand"), after(pseudoContent('" ↗"'))]}>
				release notes
			</a>{" "}
			or ask in the{" "}
			<a href="https://example.com/forum" mix={[fg("brand"), after(pseudoContent('" ↗"'))]}>
				community forum
			</a>
			.
		</p>
	),
} satisfies UtilityExampleModule;
