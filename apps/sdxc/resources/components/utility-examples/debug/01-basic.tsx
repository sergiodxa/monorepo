/**
 * The opening `debug` example: an element outlined in red during development. The site
 * is a production build, where the call draws nothing, so the canvas shows the outline a
 * development build adds and the code shows the call that adds it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** One element outlined the way a development build outlines it. */
export default {
	title: "Basic example",
	description:
		"Use `debug()` to outline an element in red while you develop. A production build drops the outline, so the call is safe to leave in; this page is one, so the example shows what development draws:",
	code: `<div mix={[debug(), ...]}>debug()</div>`,
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[demo.block(), demo.debugOutline()]}>debug()</div>
		</div>
	),
} satisfies UtilityExampleModule;
