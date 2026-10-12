/**
 * The opening `debug` example: an element outlined in red during development, which
 * renders no outline at all in a production build.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { debug } from "@sdxc/u/a11y";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A box outlined in red while developing. */
export default {
	title: "Basic example",
	description:
		"Use `debug()` to outline an element in red while you develop; production builds drop the outline, so the call is safe to leave in:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[debug(), demo.block()]}>debug()</div>
		</div>
	),
} satisfies UtilityExampleModule;
