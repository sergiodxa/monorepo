/**
 * A `contentVisibility` example comparing `"visible"` with `"hidden"`: the hidden panel
 * keeps its own box but renders none of its contents.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { contentVisibility } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A panel showing its contents beside one whose contents are skipped. */
export default {
	title: "Hiding contents",
	description:
		'Use `contentVisibility("hidden")` to skip rendering an element\'s contents while keeping its own box, and `"visible"` to render them as usual:',
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[demo.figure()]}>
				<div mix={[contentVisibility("visible"), is(48), demo.panel()]}>Rendered contents</div>
				<span mix={[demo.caption()]}>contentVisibility("visible")</span>
			</div>
			<div mix={[demo.figure()]}>
				<div mix={[contentVisibility("hidden"), is(48), demo.panel()]}>Rendered contents</div>
				<span mix={[demo.caption()]}>contentVisibility("hidden")</span>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
