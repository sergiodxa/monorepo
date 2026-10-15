/**
 * A `resize` example with `"both"`: a scrolling panel a reader can drag to any size,
 * which needs an overflow other than `visible` to show its handle.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { resize } from "sdxc/u/layout";
import { overflow } from "sdxc/u/overflow";
import { bs, is } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Both axes resize, on any element whose overflow is not visible. */
export default {
	title: "Resizing in both directions",
	description:
		'Use `resize("both")` on any element whose overflow is not visible, like `overflow("auto")`. Drag the corner to resize the panel:',
	render: () => (
		<div mix={[resize("both"), overflow("auto"), is(64), bs(32), demo.panel()]}>
			<p mix={[demo.prose()]}>Drag the handle in the corner to make this panel any size.</p>
		</div>
	),
} satisfies UtilityExampleModule;
