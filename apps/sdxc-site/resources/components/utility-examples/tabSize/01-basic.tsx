/**
 * The opening `tabSize` example: the same tab-indented snippet at two and at eight columns
 * per tab, so the reader sees the width each tab character is drawn at.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { tabSize } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A tab-indented snippet at two and eight columns per tab. */
export default {
	title: "Basic example",
	description:
		"Use `tabSize(n)` to set how many spaces wide a tab character is drawn in preformatted text; `tabSize()` uses 2:",
	render: () => (
		<div mix={[demo.stack()]}>
			<div>
				<p mix={[demo.caption()]}>tabSize()</p>
				<pre mix={[tabSize(), demo.panel()]}>
					{"if (ready) {\n\tif (loud) {\n\t\tannounce();\n\t}\n\tstart();\n}"}
				</pre>
			</div>
			<div>
				<p mix={[demo.caption()]}>tabSize(8)</p>
				<pre mix={[tabSize(8), demo.panel()]}>
					{"if (ready) {\n\tif (loud) {\n\t\tannounce();\n\t}\n\tstart();\n}"}
				</pre>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
