/**
 * The opening `pretty` example: one paragraph set twice in the same column, so the reader
 * sees pretty wrapping pull a word down to keep the last line from ending on an orphan.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { maxIs } from "sdxc/u/size";
import { pretty } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A paragraph with and without pretty wrapping, at the same width. */
export default {
	title: "Basic example",
	description:
		"Use `pretty()` to keep a paragraph from ending on a single word left alone on its last line:",
	render: () => (
		<div mix={[maxIs(96), demo.stack()]}>
			<div>
				<p mix={[demo.caption()]}>pretty()</p>
				<p mix={[pretty(), demo.prose()]}>
					The soup stand on the corner of Second Avenue served its last bowl on Friday, after
					thirty-one years of lentils, split peas and a minestrone regulars called legendary.
				</p>
			</div>
			<div>
				<p mix={[demo.caption()]}>default wrapping</p>
				<p mix={[demo.prose()]}>
					The soup stand on the corner of Second Avenue served its last bowl on Friday, after
					thirty-one years of lentils, split peas and a minestrone regulars called legendary.
				</p>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
