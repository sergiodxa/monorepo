/**
 * An `overflow` example with `scroll`, so a reader sees the scrollbars drawn even
 * though the short text fits, which keeps the box's size the same either way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { overflow } from "sdxc/u/overflow";
import { bs, is } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Scrollbars drawn whether or not the content overflows. */
export default {
	title: "Scrolling always",
	description:
		'Use `overflow("scroll")` to make an element scrollable and always show its scrollbars, where the operating system draws them, even when the content fits:',
	render: () => (
		<div mix={[overflow("scroll"), bs(24), is(64), demo.panel()]}>
			<p mix={[demo.prose()]}>This short text fits.</p>
		</div>
	),
} satisfies UtilityExampleModule;
