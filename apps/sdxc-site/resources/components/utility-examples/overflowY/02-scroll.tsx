/**
 * An `overflowY` example with `scroll`, so the vertical scrollbar is drawn even though
 * the short text fits.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { overflowY } from "sdxc/u/overflow";
import { bs, is } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A vertical scrollbar drawn whether or not the box overflows. */
export default {
	title: "Scrolling always",
	description:
		'Use `overflowY("scroll")` to always show a vertical scrollbar, where the operating system draws one, even when the content fits:',
	render: () => (
		<div mix={[overflowY("scroll"), bs(24), is(64), demo.panel()]}>
			<p mix={[demo.prose()]}>This short text fits.</p>
		</div>
	),
} satisfies UtilityExampleModule;
