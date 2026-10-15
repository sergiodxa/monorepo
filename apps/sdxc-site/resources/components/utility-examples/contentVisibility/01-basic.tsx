/**
 * The opening `contentVisibility` example: a scrolling list of sections the browser lays
 * out and paints only as they come into view, the saving `"auto"` gives a long page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { contentVisibility } from "@sdxc/u/layout";
import { overflowY } from "@sdxc/u/overflow";
import { bs } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Sections whose rendering is skipped while they are scrolled out of view. */
export default {
	title: "Basic example",
	description:
		"Use `contentVisibility()` on sections of a long page so the browser skips their rendering work until they scroll near the viewport. Scroll the list:",
	align: "stretch",
	render: () => (
		<div mix={[overflowY("auto"), bs(64), demo.stack()]}>
			<section mix={[contentVisibility(), demo.panel()]}>Chapter 1: Layout</section>
			<section mix={[contentVisibility(), demo.panel()]}>Chapter 2: Size</section>
			<section mix={[contentVisibility(), demo.panel()]}>Chapter 3: Color</section>
			<section mix={[contentVisibility(), demo.panel()]}>Chapter 4: Typography</section>
			<section mix={[contentVisibility(), demo.panel()]}>Chapter 5: Effects</section>
			<section mix={[contentVisibility(), demo.panel()]}>Chapter 6: Overflow</section>
			<section mix={[contentVisibility(), demo.panel()]}>Chapter 7: State</section>
		</div>
	),
} satisfies UtilityExampleModule;
