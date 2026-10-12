/**
 * The opening `divide` example: a list whose items are split by a hairline, so a reader
 * sees one call on the parent draw a border between every child but the last.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { divide } from "@sdxc/u/overflow";
import { p } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A divider between stacked items, drawn from the parent. */
export default {
	title: "Basic example",
	description:
		"Use `divide()` on a parent to draw a border between each of its children, stacked along the block axis:",
	render: () => (
		<ul mix={[divide(), demo.panel(), demo.stack()]}>
			<li mix={[p(3)]}>Inbox</li>
			<li mix={[p(3)]}>Drafts</li>
			<li mix={[p(3)]}>Archive</li>
		</ul>
	),
} satisfies UtilityExampleModule;
